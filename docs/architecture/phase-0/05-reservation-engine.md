# 05 — Target reservation engine

- **Current implementation:** No reservation, stay, inventory hold, payment, booking-source, calendar, or concurrency implementation exists. The legacy application only displays affiliate deals and records optional clicks.
- **Target state:** A tenant/property-scoped reservation aggregate whose lifecycle is independent from stays and payments, with database-authoritative capacity, idempotent commands/callbacks, immutable pricing evidence, and auditable transitions.
- **Decision status:** Proposed critical-domain design. PostgreSQL correctness and modular-monolith transactions align with accepted architecture; exact cancellation products, hold TTL, and payment guarantee policies require later product decisions.
- **Last verified:** 2026-08-09

> **Target-only artifact.** States, commands, events, constraints, SQL sketches, and workflows below are specifications for later changes, not implemented behavior.

The authoritative Reservation/hold slice is a Phase 4 target after Phase 3 Inventory/Pricing concurrency evidence. Guest/Stay operations are Phase 5, actual Payment/Finance is Phase 6, and public marketplace checkout is Phase 7; see [12-phase-roadmap.md](12-phase-roadmap.md). Phase 4 may use only a narrowly specified payment guarantee/reference and must not pull later domains forward.

Absence of current Reservation/Stay/Inventory tables and flows is evidenced by [current-data-model.md](../../current-system/current-data-model.md), [current-user-flows.md](../../current-system/current-user-flows.md), and [repository-map.md](../../current-system/repository-map.md).

## Separate lifecycles

Lelungo must not create one status enum containing booking, payment, check-in, refund, and housekeeping states.

| Lifecycle                   | Owner       | Question answered                                                                         |
| --------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Reservation                 | Reservation | Does Lelungo have a pending/confirmed/cancelled commercial promise for these dates/items? |
| Inventory allocation        | Inventory   | Is capacity held, committed, released, expired, or blocked?                               |
| Payment intent/transactions | Payment     | What provider-independent money action was attempted/authorized/captured/failed/refunded? |
| Stay                        | Operations  | Is the actual visit planned, in house, completed, or cancelled?                           |
| Unit readiness/task         | Operations  | Is a unit dirty, cleaning, inspected, ready, or out of service, and what work is open?    |

A UI calendar may project all five. That projection is not allowed to mutate or replace their source states.

## Reservation aggregate

### Target states

| State       | Meaning                                                                                                                       | Terminal |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| `PENDING`   | Reservation record exists with immutable quote evidence and protected inventory while a guarantee/payment/approval completes. | No       |
| `CONFIRMED` | Commercial promise is accepted and Inventory has a committed allocation.                                                      | No       |
| `CANCELLED` | Reservation was explicitly cancelled under policy or authorized override; financial consequences continue separately.         | Yes      |
| `EXPIRED`   | Pending reservation lost its hold before confirmation.                                                                        | Yes      |
| `NO_SHOW`   | Confirmed guest did not arrive by the property policy cutoff and no Stay became in-house.                                     | Yes      |
| `FULFILLED` | All planned Stays for the reservation completed.                                                                              | Yes      |

`DRAFT` is a client/session concept or short-lived Pricing quote, not an authoritative Reservation state. `HELD` belongs to Inventory. `AWAITING_PAYMENT`, `AUTHORIZED`, `PAID`, `REFUND_PENDING`, and `REFUNDED` belong to Payment/read projections. `CHECKED_IN` and `CHECKED_OUT` belong to Stay.

Terminal Reservation states are not reopened. A correction creates an audited replacement/rebooking or an explicit adjustment command; history is never rewritten.

### Transition table

Every mutation validates input, authenticates, resolves trusted tenant, authorizes permission/property scope, checks an expected aggregate version, then runs the listed transaction. External side effects are represented by outbox events and occur after commit.

| From → to                                             | Allowed actor                                                                                                                | Guards                                                                                                                                                          | Transactional side effects                                                                                                                                       | Event(s)                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| none → `PENDING`                                      | Guest checkout authority, scoped PMS staff, or verified channel adapter                                                      | Idempotency key; same tenant/property; valid guest/source; quote unexpired and input versions valid; restrictions satisfied; Inventory can hold every item/date | Create Reservation/items, participant refs, immutable provisional price evidence, Inventory hold(s), state history, audit/outbox                                 | `ReservationCreated`, `InventoryHeld`                                   |
| `PENDING` → `CONFIRMED`                               | Reservation application coordinator after normalized Payment outcome, or staff with allowed pay-at-property/guarantee policy | Expected version; hold is active; payment/guarantee policy satisfied; amount/currency match; no terminal transition                                             | Lock Reservation/hold; convert held capacity to committed capacity; finalize confirmed snapshot/revision; append history/audit/outbox                            | `ReservationConfirmed`, `InventoryCommitted`                            |
| `PENDING` → `CANCELLED`                               | Guest within self-service policy, scoped staff, channel adapter, or authorized system workflow                               | Expected version; cancellation authority; reason; no competing confirmation                                                                                     | Mark cancelled; release active hold and any reserved promotion redemption; request Payment void/refund asynchronously if needed; append evidence                 | `ReservationCancelled`, `InventoryReleased`                             |
| `PENDING` → `EXPIRED`                                 | Inventory/Reservation expiry worker or an acquisition transaction discovering elapsed TTL                                    | Database time is past `expires_at`; still pending; no successful confirmation won the row lock                                                                  | Mark hold expired and Reservation expired; release pooled held counters; append evidence                                                                         | `InventoryHoldExpired`, `ReservationExpired`                            |
| `CONFIRMED` → `CANCELLED`                             | Authorized guest, scoped staff, verified channel command, or platform override with separate permission                      | Expected version; cancellation policy/override; no in-house Stay; refund/fee decision calculated from captured policy snapshot                                  | Mark cancelled; release future committed inventory; append cancellation charge/adjustment request; request refund asynchronously; preserve all financial history | `ReservationCancelled`, `InventoryReleased`, optional `RefundRequested` |
| `CONFIRMED` → `NO_SHOW`                               | Scoped front office/manager or policy scheduler                                                                              | Property-local no-show cutoff passed; no in-house/completed Stay; expected version; reason recorded                                                             | Mark no-show; release remaining allocation according to policy; create financial adjustment request; cancel planned Stay                                         | `ReservationNoShowRecorded`, `InventoryReleased`                        |
| `CONFIRMED` → `FULFILLED`                             | System consuming idempotent Operations outcome                                                                               | Every non-cancelled Stay is completed; no conflicting cancellation/no-show                                                                                      | Mark fulfilled and append history/audit/outbox; no provider call in transaction                                                                                  | `ReservationFulfilled`                                                  |
| `PENDING`/`CONFIRMED` → same state with revised items | Guest/staff/channel through `ChangeReservationDates`                                                                         | Expected version; policy permits change; replacement quote valid; new allocation succeeds before old allocation is released                                     | Atomically allocate new dates, append new price revision, update items/version, then release replaced allocation; never blind-update dates                       | `ReservationChanged`, inventory delta events                            |

Partial item cancellation, split stays, and multi-property carts are deferred. The first aggregate should keep one Reservation within one Property and apply transitions to all items atomically. Later partial behavior requires item-level states and explicit financial/inventory allocation rules.

## Stay aggregate

One confirmed Reservation can create one or more Stays when operational splitting is later justified. Initially one Reservation normally creates one Stay.

| From → to                | Actor                                                        | Guards                                                                                                                                                            | Side effects                                                                                                           | Event                                                         |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| none → `PLANNED`         | System after `ReservationConfirmed`                          | Idempotent reservation/stay link; reservation remains confirmed                                                                                                   | Create Stay with planned arrival/departure and minimum guest refs                                                      | `StayPlanned`                                                 |
| `PLANNED` → `IN_HOUSE`   | Scoped front office or reservation-scoped self-check-in flow | Confirmed Reservation; compatible non-overlapping Unit assignment; unit readiness is `READY`; arrival window or audited override; required identity/policy checks | Record actual check-in time/actor; lock assignment; append audit/outbox                                                | `GuestCheckedIn`                                              |
| `IN_HOUSE` → `COMPLETED` | Scoped front office/system policy                            | Actual check-in exists; checkout authorized; departure/financial blocking policy handled explicitly                                                               | Record actual checkout; end assignment; create idempotent housekeeping work through same Operations transaction/outbox | `GuestCheckedOut`, `StayCompleted`, `HousekeepingTaskCreated` |
| `PLANNED` → `CANCELLED`  | System after Reservation cancellation/expiry/no-show         | Stay never became in-house; matching source event not already applied                                                                                             | Mark planned Stay cancelled; release planned assignment through Inventory contract                                     | `StayCancelled`                                               |

An in-house guest who leaves early is checked out with an amended departure/financial adjustment; the Stay is not changed to `CANCELLED`. Housekeeping readiness is an operational unit state and never a Stay or Reservation state.

## Payment-state separation

Payment stores append-oriented transactions and a derived intent state such as `REQUIRES_ACTION`, `PROCESSING`, `AUTHORIZED`, `CAPTURED`, `CANCELLED`, `FAILED`, or `EXPIRED`. Refund has its own lifecycle. Reservation only evaluates a versioned guarantee rule, for example:

- full capture required before confirmation;
- authorization required before confirmation;
- deposit captured before confirmation; or
- authorized staff selected a permitted pay-at-property policy.

The provider cannot set Reservation state directly. A verified adapter deduplicates a callback, records a normalized Payment fact, and invokes/publishes an idempotent Reservation confirmation command.

## Authoritative anti-double-booking

The invariant is:

> One physical Unit cannot have overlapping active allocations or assignments for `[check_in_date, check_out_date)`, and a pooled inventory date cannot allocate more than its configured capacity.

The guest UI, search projection, provider cache, Redis lock, and preflight availability query are never sufficient authority.

### Physical-unit inventory

For an entire private villa or a specifically selected room, Inventory stores a range and status on an allocation. A later PostgreSQL migration can use `btree_gist` plus an exclusion constraint conceptually equivalent to:

```sql
EXCLUDE USING gist (
  tenant_id WITH =,
  unit_id WITH =,
  occupancy_range WITH &&
)
WHERE (status IN ('HELD', 'CONFIRMED', 'BLOCKED'));
```

`occupancy_range` is `daterange(check_in_date, check_out_date, '[)')`. A physical operational block uses the same conflict surface. The insert/update succeeds for one contender and PostgreSQL rejects an overlap for the other, regardless of application race timing. The application maps the constraint error to a generic availability conflict and may recalculate alternatives.

The partial predicate uses stored status, not `expires_at > now()`: a time-dependent predicate is not a safe exclusion-constraint definition. Before trying to acquire a unit, the transaction locks and transitions any elapsed `HELD` allocation for that resource to `EXPIRED`; background cleanup performs the same idempotent operation proactively. A delayed cleanup may temporarily reduce apparent availability, but can never cause overselling.

Pooled reservations that later receive a specific Unit also use an exclusion constraint on `unit_assignments`; the daily pool ledger prevents overselling before assignment, and the assignment constraint prevents physical collision afterward.

### Pooled room-type inventory

For interchangeable Deluxe/Family rooms, one `inventory_days` row exists per tenant, pool, and occupancy date, with integer `capacity`, `held`, `sold`, and `blocked` counters and a database check:

```text
capacity >= 0
held >= 0
sold >= 0
blocked >= 0
held + sold + blocked <= capacity
```

A multi-night allocation:

1. selects every date in `[check_in_date, check_out_date)`;
2. locks rows in ascending date order with `FOR UPDATE` (or an equivalent atomic conditional update);
3. verifies every row has requested free capacity;
4. increments `held` on all rows and creates one allocation/idempotency record; and
5. commits all dates or rolls back all dates.

Confirmation decrements `held` and increments `sold` in the same locked transaction. Expiry/release decrements `held`; confirmed cancellation decrements `sold` for releasable future dates. Missing date rows fail closed rather than being interpreted as unlimited capacity.

## Inventory hold contract

An Inventory hold contains at least:

- opaque hold/allocation ID;
- tenant, property, pool, optional Unit, occupancy dates, and quantity;
- status (`HELD`, `CONFIRMED`, `RELEASED`, `EXPIRED`);
- `expires_at` computed from PostgreSQL time;
- purpose/source and reservation/idempotency reference;
- created/transition timestamps and optimistic version.

The exact TTL is a product/payment-channel decision and is not guessed in Phase 0. It must be bounded, persisted with the pricing/checkout policy version, visible to the guest, and long enough for the selected payment flow. Automatic sliding extensions are prohibited. An explicit, rate-limited extension command must lock the hold, verify it is still active, enforce a maximum lifetime, and remain idempotent.

The expiry worker is operational hygiene, not the sole correctness mechanism. New acquisition and confirmation transactions evaluate the hold against database time while holding the relevant rows.

## Idempotency

Every externally retryable mutation—guest create/confirm/cancel, PMS mutation, channel import, provider callback, expiry job—has an idempotency boundary.

```text
scope = tenant + operation + actor/channel/provider account + idempotency key
value = request hash + processing/result status + stable aggregate/result IDs
```

- Same key and same hash returns the stored result without duplicating inventory, reservation, payment, refund, or event records.
- Same key and different hash returns a conflict.
- The idempotency record and business write commit together.
- Provider event IDs/references have additional database uniqueness because providers retry outside Lelungo's request-key convention.
- Consumers deduplicate by event ID and make side effects idempotent; “exactly once” delivery is not assumed.

## TTL, payment, and cancellation races

### Payment callback versus expiry

Both paths lock the hold/allocation and Reservation in a deterministic order.

1. If the normalized successful payment locks first and the hold is still unexpired, confirmation commits the hold; the expiry worker later sees `CONFIRMED` and does nothing.
2. If expiry locks first, it changes the hold/Reservation to terminal expired state and releases capacity; a later payment callback cannot reopen it.
3. For a late successful payment, the original terminal Reservation remains unchanged. A policy may authorize a **new Reservation with a new ID** and an audited `rebooksReservationId`-style link; that new aggregate must acquire a new authoritative allocation in its own idempotent transaction before it can confirm. If capacity is unavailable, no Reservation confirms and Payment/Finance records a refund or manual-reconciliation obligation.

Payment success never overrides an exclusion constraint or daily-capacity check.

### Duplicate payment callbacks

The adapter verifies signature/raw body/replay requirements before domain handling. A unique provider-account/event ID means only one transaction is normalized. Repeated callbacks return the prior result and cannot capture, confirm, post ledger entries, or notify twice.

### Confirmation versus cancellation

Both commands lock Reservation and check expected version/state. Only one transition can win. The loser returns a stable conflict/current outcome and performs no external side effect. If a payment outcome arrives after cancellation, it follows the late-payment compensation path.

### Date change versus another buyer

`ChangeReservationDates` acquires replacement capacity before releasing the original allocation, in one local transaction where possible. If replacement acquisition fails, original dates remain unchanged. A date field is never updated before inventory protection exists.

## End-to-end command flows

### Create pending reservation

1. Validate external DTO and idempotency key.
2. Authenticate/resolve guest or staff/channel authority, trusted tenant, property, and source.
3. Calculate a versioned Pricing quote outside a long-held database transaction.
4. Begin transaction; claim idempotency record and revalidate quote expiry/input versions/restrictions.
5. Acquire all Inventory resources using physical exclusion or pooled locked ledger.
6. Insert Reservation/items, participant references, price snapshot/lines, state history, audit, and outbox.
7. Commit; only then initiate Payment and asynchronous delivery.

If any item/date fails, the whole Reservation creation rolls back. No partially held basket is returned as successful.

### Confirm reservation

1. Deduplicate the triggering command/provider event.
2. Lock Reservation and its active allocation(s).
3. Verify `PENDING`, expected version, unexpired holds, and guarantee amount/currency/policy.
4. Move Inventory held capacity to confirmed/sold and Reservation to `CONFIRMED` atomically.
5. Append state history, audit, and outbox; commit.
6. Create Stay/notifications/analytics/channel updates idempotently after commit.

### Cancel confirmed reservation

1. Authorize actor and property scope; lock Reservation/version.
2. Evaluate the captured cancellation-policy version and actual timing in the Property timezone.
3. Mark Reservation cancelled and release eligible future Inventory atomically.
4. Append immutable fee/refund decision inputs and outbox.
5. Payment executes refund/void asynchronously; Finance posts resulting transactions. Refund failure does not resurrect Reservation.

## Concurrency verification scenarios required before release

| Scenario                                                    | Required result                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Two users hold the same private villa for overlapping dates | Exactly one active allocation succeeds; the other receives availability conflict.                         |
| Two users take the last pooled room over multiple nights    | Only one transaction increments every date; the other rolls back all dates.                               |
| Different non-overlapping ranges for one Unit               | Both can succeed, including checkout-to-next-check-in boundary.                                           |
| Hold expires while payment callback arrives                 | Row-lock order produces one terminal outcome; late money is reallocated or compensated, never overbooked. |
| Provider sends callback repeatedly/out of order             | One normalized financial fact and one Reservation transition; stale events do not regress state.          |
| Guest cancels while staff confirms                          | Expected-version/row lock allows one transition; loser is a conflict/no-op.                               |
| Staff changes dates while another buyer takes target dates  | Replacement allocation fails atomically and original reservation remains intact.                          |
| Worker crashes after source commit before notification      | Outbox retains unpublished event; retry delivers idempotently.                                            |
| Duplicate channel reservation import                        | External reference/idempotency returns the same Reservation or explicit conflict.                         |
| Maintenance blocks a unit with a future assignment          | Command rejects or creates an explicit conflict workflow; it never silently invalidates a confirmed stay. |

These require PostgreSQL integration tests, not only mocked unit tests.

## Decisions

### Decision: keep Reservation state minimal and orthogonal

- **Rationale:** Commercial, operational, inventory, and financial lifecycles have different actors, guards, timing, and failure recovery.
- **Alternatives considered:** One all-purpose booking enum; store check-in/payment/refund flags on Reservation.
- **Why alternatives were not selected:** They create invalid combinations, provider-driven booking changes, and an unreviewable state explosion.
- **Use now or later:** Fix the vocabulary now; implement each state machine in its owner context during later phases.
- **Migration path:** New aggregates reference stable IDs and publish normalized events. Calendar/dashboard views join projections rather than merging ownership.

### Decision: enforce two inventory strategies in PostgreSQL

- **Rationale:** Unique physical resources need overlap exclusion, while interchangeable room types need atomic daily capacity.
- **Alternatives considered:** Pre-check then insert; frontend/cache availability; distributed lock; only optimistic versioning.
- **Why alternatives were not selected:** They leave race windows or introduce a weaker/additional lock authority without removing the need for database constraints.
- **Use now or later:** Design requirement now; implement `daterange` exclusion or daily ledgers with the first corresponding inventory mode.
- **Migration path:** Add constraints/tables forward-only, backfill/validate date rows, run concurrent integration tests, then route reservation writes through the authoritative Inventory contract.

### Decision: persist holds with database-time TTL and state-based constraints

- **Rationale:** Expiry is a race with payment/confirmation and must serialize on the same authoritative rows; background scheduling can be delayed.
- **Alternatives considered:** Browser timer; cache-only TTL; worker deletion; a partial constraint based on current time.
- **Why alternatives were not selected:** They can expire inconsistently, lose evidence, or cannot safely enforce overlap as time changes.
- **Use now or later:** Required when checkout holds are implemented. Exact TTL is decided with the payment/product phase.
- **Migration path:** Introduce allocation statuses/expiry, acquisition-time expiry and cleanup job, then monitor hold age/expiry latency before allowing bounded extension.

### Decision: make all external/retryable transitions idempotent

- **Rationale:** Browsers, providers, jobs, networks, and channel systems retry; duplicate side effects are a normal failure mode.
- **Alternatives considered:** Best-effort duplicate checks in memory; assume exactly-once callbacks/delivery.
- **Why alternatives were not selected:** Process restarts and concurrent delivery bypass in-memory checks, and providers/brokers do not promise application-level exactly-once effects.
- **Use now or later:** Idempotency is mandatory with the first Reservation/Payment/Distribution mutation.
- **Migration path:** Add scoped idempotency/provider-event uniqueness in the same transaction as each command, then add replay/concurrency tests before integration release.
