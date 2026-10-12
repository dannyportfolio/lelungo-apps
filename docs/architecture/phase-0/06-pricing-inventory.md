# 06 — Target pricing, inventory, and financial correctness

- **Current implementation:** No inventory pool, availability calendar, rate plan, pricing rule, restriction, promotion, price snapshot, payment provider, refund, settlement, ledger, or payout model exists. Legacy deal prices are display/mock/affiliate data and are not PMS pricing authority.
- **Target state:** PostgreSQL-authoritative physical and pooled inventory, deterministic and reconstructable reservation pricing, integer money, provider-neutral payment records, and append-only balanced financial evidence.
- **Decision status:** Proposed target design. Database correctness, PostgreSQL, and no JavaScript floating point follow accepted principles; exact rate/tax/cancellation policy, hold TTL, payment provider, and payout operations require later product/legal/finance decisions.
- **Last verified:** 2026-08-09

> **Target-only artifact.** The models, formulas, ports, constraints, and examples below do not create a booking engine, payment integration, ledger, schema, or provider commitment.

Inventory/Pricing foundations are Phase 3 targets; holds and confirmed Reservation snapshots are Phase 4; Payment/Finance/provider integration is Phase 6; public application of these contracts is Phase 7. [12-phase-roadmap.md](12-phase-roadmap.md) owns the gates, and each slice requires its own OpenSpec change.

Current absence and legacy separation are evidenced by [current-data-model.md](../../current-system/current-data-model.md), [current-user-flows.md](../../current-system/current-user-flows.md), and [integrations-inventory.md](../../current-system/integrations-inventory.md); earlier target concepts are reconciled from [proposed-domain-model.md](../../target-system/proposed-domain-model.md).

## Ownership at a glance

| Concern                                                                   | Authoritative context | Boundary                                                                                             |
| ------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Physical/pool capacity, holds, sales, blocks, assignments                 | Inventory             | Pricing/Search can query but cannot mutate capacity.                                                 |
| Rate plans, rates, restrictions, cancellation versions, quote calculation | Pricing               | Inventory remains availability authority; Promotion returns a versioned benefit decision.            |
| Promotion/coupon limits and redemption                                    | Promotion             | Pricing applies the returned decision; Reservation confirms/releases redemption idempotently.        |
| Confirmed price evidence                                                  | Reservation           | Copies immutable Pricing result/input versions; later rule edits cannot alter it.                    |
| Provider intent/capture/refund facts                                      | Payment               | Provider SDK schemas end at adapters; Reservation consumes normalized outcomes.                      |
| Invoice, expense, settlement, ledger, owner payout                        | Finance               | Payment supplies money facts; Finance never rewrites provider transactions.                          |
| Lelungo subscription billing                                              | Platform Billing      | Separate customer, accounts, invoice sequence, entitlement, and provider namespace from guest money. |

## Inventory design

### Inventory Pool

An `InventoryPool` is the sellable resource behind a ReservationItem. It belongs to one tenant and Property and has one allocation mode:

- `PHYSICAL_UNIT`: points to one uniquely assignable Unit; capacity is one for an occupancy interval. Used for an entire private villa or preselected room.
- `POOLED`: points to a Room Type/compatible Unit set; dated integer capacity is sold before a Unit is assigned. Used for homestay Deluxe/Family inventory.

No implicit overbooking is allowed in the initial design. If operators later require an explicit overbooking allowance, it must be a named, permissioned policy included in daily capacity and risk reporting—not a negative availability counter or constraint bypass.

### Availability formulas

For a pooled date:

```text
free_to_sell = capacity - held - sold - blocked
```

All operands are non-negative integers, and PostgreSQL enforces `held + sold + blocked <= capacity`. `capacity` changes are effective-dated and cannot reduce a date below already held/sold/blocked quantity. Creating/deactivating Units does not silently rewrite historical capacity.

For a physical Unit:

```text
available = no HELD, CONFIRMED, or BLOCKED allocation overlaps
            [check_in_date, check_out_date)
```

PostgreSQL `daterange` exclusion is final authority. A read response includes `as_of`, resource/version information, and bookable quantity but creates no right to buy.

### Physical-unit conflict control

Active holds, committed allocations, and operational blocks use one exclusion-compatible resource/range model (or constraints with equivalent coverage):

```sql
EXCLUDE USING gist (
  tenant_id WITH =,
  unit_id WITH =,
  occupancy_range WITH &&
)
WHERE (status IN ('HELD', 'CONFIRMED', 'BLOCKED'));
```

This requires a reviewed forward migration and the appropriate PostgreSQL GiST support. A checkout on 12 August and the next check-in on 12 August do not overlap because ranges are half-open.

A pooled sale later assigned to a Unit uses a second overlap-protected `unit_assignments` range. Assigning a Unit changes neither pool `sold` nor the Reservation price; it only binds actual physical fulfillment.

### Pooled daily ledger

`inventory_days` is unique on `(tenant_id, inventory_pool_id, inventory_date)`. A hold over N nights locks all N rows in ascending date order, validates capacity, and increments every row in one transaction. Any missing/unavailable date rolls back the entire attempt. This deterministic lock order reduces deadlock risk; deadlock/serialization failures are retried within a small bounded policy using the same idempotency key.

Counter transitions are explicit:

| Action                            | Daily counter change                 |
| --------------------------------- | ------------------------------------ |
| Acquire hold                      | `held += quantity`                   |
| Confirm hold                      | `held -= quantity; sold += quantity` |
| Release/expire hold               | `held -= quantity`                   |
| Cancel confirmed future inventory | `sold -= releasable quantity`        |
| Create operational block          | `blocked += quantity`                |
| Remove operational block          | `blocked -= quantity`                |

Each action validates non-negative results, references one allocation/idempotency record, and emits an outbox fact in the same transaction. Reconstructable adjustment history is retained rather than directly “fixing” unexplained counters.

### Holds and TTL

Holds are persisted, opaque, tenant-scoped, and carry database-computed `expires_at`. Exact TTL is deferred to the checkout/payment design and can differ only through a versioned bounded policy. Browser timers and cache expiration are display/optimization only.

- Acquisition first transitions elapsed active holds for the target resource under lock, then attempts allocation.
- A cleanup worker expires holds proactively and idempotently; delayed cleanup can block a sale temporarily but cannot create overselling.
- Confirmation and expiry lock the same hold/Reservation rows; only one state transition wins.
- A late successful payment re-acquires authoritative inventory or enters refund/manual reconciliation. It never resurrects expired capacity.
- Duplicate guest, channel, worker, or provider requests resolve through transactional idempotency/provider-event uniqueness.

Detailed race handling and state transitions are defined in [05-reservation-engine.md](05-reservation-engine.md).

### Blocks and unit readiness

Inventory owns capacity blocks; Operations owns maintenance/housekeeping work and unit readiness. A maintenance command requests an Inventory block through a public contract. If a requested block overlaps a confirmed assignment, the operation fails or opens an explicit relocation/conflict workflow; it never silently cancels a reservation. `DIRTY` alone need not remove future capacity, while `OUT_OF_SERVICE` normally does according to an effective date range.

### Availability caching

Property catalog and broad availability hints may later be cached/projection-backed with short TTL and event invalidation. The cache returns no hold token and cannot confirm a Reservation. `HoldInventory` always executes against PostgreSQL; service availability must not depend on stale cached inventory.

## Pricing domain model

### Rate Plan and inputs

A Rate Plan is a versioned commercial product for compatible Inventory Pools. It references, rather than embeds ambiguously:

- base/currency and dated Rate versions;
- meal/payment/guarantee terms where applicable;
- versioned cancellation policy;
- occupancy/capacity rules;
- restrictions;
- fees and tax rules;
- allowed Promotion combinations; and
- sale/channel/property scope.

Publishing creates a new immutable/effective-dated version. Historical versions remain available for Reservation explanation. An unversioned mutable `room.price` is not part of the target model.

### Restrictions

Restriction evaluation occurs before a quote can be accepted:

| Restriction                 | Target semantics                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Minimum/maximum stay        | Validate number of nights for the selected arrival/date/rate-plan rule.                                                 |
| Closed to arrival (`CTA`)   | Reject check-in on the affected date. It does not automatically close an in-progress stay.                              |
| Closed to departure (`CTD`) | Reject checkout on the affected date.                                                                                   |
| Stop sell/closed            | Reject new sales for affected pool/rate plan/date; existing confirmed records remain evidence.                          |
| Advance booking window      | Compare database instant converted to Property timezone against min/max lead-time policy.                               |
| Occupancy                   | Validate adults/children/infants and total occupancy against explicit Unit/Room Type policy. Definitions are versioned. |
| Channel/market scope        | Apply only to an allowed direct/PMS/channel source; never trust a client label without adapter authority.               |
| Promotion/coupon            | Require an eligible versioned decision and available redemption; benefit combination/order is explicit.                 |

Conflicting rules have deterministic precedence and no silent tie. A proposed precedence is: explicit date override, named season, day-of-week rule, then base rate; within a level an explicit unique priority/version applies. A later Pricing specification must finalize this precedence before persistence.

### Deterministic calculation pipeline

For identical canonical inputs and rule versions, calculation produces identical integer line items and total:

1. Normalize tenant, property, Inventory Pool, Property timezone, occupancy dates, guest counts, source, rate plan, and currency.
2. Validate date order, maximum quote horizon, occupancy, rate-plan eligibility, restrictions, and rule version/effective windows.
3. Resolve the nightly base rate through the fixed override/season/weekday/base precedence.
4. Apply occupancy pricing and extra-guest amounts per night according to a versioned rule.
5. Obtain versioned Promotion/coupon decisions and apply discounts in an explicit order with stacking/exclusivity rules.
6. Add cleaning, service, and other named fees as distinct lines.
7. Apply tax rules to explicitly identified taxable bases, with inclusive/exclusive behavior and jurisdiction/policy version.
8. Round at documented line/subtotal boundaries, allocate any remainder deterministically, and compute totals from line sums.
9. Return the input/rule versions, line explanations, currency/unit scale, total, calculation version, and expiry.

Pricing calculation does not decrement Inventory. A guest quote composition can query availability, but Reservation creation separately revalidates the quote versions and acquires capacity transactionally.

Exact discount-before-tax, tax-inclusive, service-fee, cancellation, and jurisdiction rules require Indonesian product/legal/finance review. The architecture requires versioned explicit decisions; it does not invent them.

## Immutable price snapshot

Every ReservationItem accepted into `PENDING`, and especially every `CONFIRMED` revision, stores enough evidence to answer “why did this reservation cost Rp X?” without querying current mutable rates.

| Snapshot field group | Required evidence                                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/scope       | Snapshot/schema/calculation version, tenant, property, Reservation/Item, Inventory Pool, optional Room Type/Unit, Rate Plan and version |
| Timing               | Property timezone, quote/calculation instant, check-in/out dates, nights, source/channel, quote expiry used at creation                 |
| Occupancy            | Adults/children/other configured categories and capacity policy version                                                                 |
| Money                | Currency, currency-unit scale, nightly subtotal, discounts, fees, taxes, grand total—all integers                                       |
| Night lines          | One line/date with base rate and every override/rule ID/version that affected it                                                        |
| Adjustments          | Extra guest, cleaning/service/other fees, tax bases/rates, promotions/coupon IDs and versions, deterministic rounding/remainder         |
| Policy               | Restriction results, cancellation policy/version, payment/guarantee policy/version                                                      |
| Integrity            | Canonical input hash and optional calculation hash for audit/replay; no secret/provider token                                           |

Important totals and searchable keys are typed columns/line tables. A versioned validated JSON explanation may supplement them but cannot be the only location for money, ownership, or rule identity.

Snapshots are immutable. A staff-authorized price/date change creates a new Reservation revision/snapshot and explicit adjustment; it does not edit the original. Rate, restriction, promotion, fee, or tax changes affect future calculations only.

## Monetary representation

All authoritative amounts use an integer `amount_minor`/business unit stored as PostgreSQL `BIGINT`, accompanied by an explicit three-letter currency and captured unit scale. For an initial IDR policy where one stored unit is one rupiah, Rp1,500,000 is stored as integer `1500000`, not floating `1500000.0`; a provider adapter performs any provider-specific conversion explicitly.

Rules:

- Application code uses `bigint` or a reviewed decimal/rational calculation that must resolve to integer units at defined rounding boundaries; never JavaScript `number` arithmetic for money.
- JSON/REST DTOs serialize potentially large integer amounts as decimal strings, e.g. `{ "amountMinor": "1500000", "currency": "IDR", "unitScale": 0 }`, so they cannot exceed JavaScript safe-integer precision.
- Percentage rules use basis points or numerator/denominator, not binary floating point.
- One calculation/ledger transaction has one currency. Currency conversion is a separately quoted transaction with source/target amounts, rate source/version, rounding, and timestamp.
- Sum of line items must equal displayed/charged total. Any rounding remainder is allocated by a stable documented rule.
- Negative values are permitted only for typed discount/reversal/adjustment lines; APIs do not accept arbitrary signed amounts.

The exact currency-unit catalog must be approved before multi-currency/payment implementation and captured with historical records so a later catalog change cannot reinterpret money.

## Promotion correctness

Promotion owns eligibility, finite budget/usage, coupon uniqueness, and redemption lifecycle. Pricing receives a versioned benefit response. Reservation reserves a redemption with the same idempotency key as inventory/creation; confirmation commits it, and cancellation/expiry releases it according to policy.

A Promotion cannot rewrite a confirmed snapshot. Stacking order, maximum benefit, property/channel scope, and budget checks are deterministic and captured. Concurrent use of a last coupon/budget unit is serialized by Promotion rows/constraints, not an in-memory counter.

## Payment provider abstraction

Core domains depend on provider-neutral ports; Midtrans, Xendit, or another provider is a later commercial/technical selection.

```text
PaymentGatewayPort
  createIntent(normalized request, idempotency key)
  getIntentStatus(provider reference)
  authorize/capture/void (only when supported and policy requires)
  refund(normalized request, idempotency key)
  verifyAndNormalizeWebhook(raw request)

DisbursementProviderPort
  createPayout(normalized payout, idempotency key)
  getPayoutStatus(provider reference)
  verifyAndNormalizeWebhook(raw request)
```

Provider SDK types, credentials, error bodies, and status names end at adapters. Domain records store normalized statuses, opaque provider/account/reference IDs, safe failure codes, and a minimal/redacted receipt. Credentials live only in server-side secret storage/configuration.

Webhooks verify raw-body signature, timestamp/replay policy, endpoint/account ownership, and payload schema before a domain command. `(provider, provider_account_id, provider_event_id)` is unique. Unknown/out-of-order events are retained as sanitized reconciliation evidence and cannot regress a terminal normalized state.

## Payment records and states

| Record             | Purpose and invariant                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PaymentIntent      | Expected amount/currency, Reservation/Invoice reference, guarantee purpose, provider selection, idempotency, and derived lifecycle. Client amount/provider status is never trusted. |
| PaymentTransaction | Append-only normalized attempt/fact such as authorization, capture, failure, void, chargeback/reversal; provider reference is unique in its scope.                                  |
| ProviderEvent      | Deduplicated verified callback receipt with processing result and safe digest/minimum payload.                                                                                      |
| Refund             | Requested amount/reason/actor and independent `REQUESTED -> PROCESSING -> SUCCEEDED/FAILED/CANCELLED` lifecycle.                                                                    |

PaymentIntent may derive states such as `REQUIRES_ACTION`, `PROCESSING`, `AUTHORIZED`, `CAPTURED`, `CANCELLED`, `FAILED`, or `EXPIRED`, but money truth comes from append-oriented transactions. Corrections append reversals; they do not overwrite a capture.

At transaction time under lock:

```text
requested_refund <= captured_refundable
                    - succeeded_refunds
                    - already_reserved_pending_refunds
                    - applicable chargebacks/reversals
```

Reservation cancellation can request a refund but does not wait for provider completion and does not become `REFUNDED`. A failed refund remains a Payment/Finance exception requiring retry/reconciliation.

## Finance ledger, settlement, and payout

Payment answers what a provider did. Finance answers what Lelungo and the property economically owe/own.

### Ledger

- Each ledger transaction contains at least two postings whose debits/credits balance in one currency.
- Accounts are tenant/property/platform scoped by explicit ownership; platform subscription and guest/owner money do not share accidental accounts.
- Source type/ID and idempotency key are unique so one `PaymentCaptured` fact cannot post twice.
- Corrections use linked reversal/adjustment transactions; posted entries are immutable.
- An invoice is versioned/issued evidence. Voids/credit notes follow policy; issued numbering and lines are not casually edited.

Exact chart of accounts and revenue-recognition policy require accounting ownership before implementation. Phase 0 defines balance and traceability invariants, not accounting advice.

### Settlement

A Settlement records provider-reported gross transactions, fees, taxes/adjustments, net deposit, currency, provider account, period/reference, and reconciliation status. Import is idempotent; unmatched or amount-mismatched lines enter an exception queue rather than being forced onto a Reservation.

### Owner payout

A Payout is created only from settled, owner-available ledger balance after refunds, chargebacks, platform fees, taxes/withholding, previous payouts, and configured reserves. Scheduling locks/reserves available value transactionally. Provider processing then advances an independent lifecycle such as `PENDING -> SCHEDULED -> PROCESSING -> PAID`, with `FAILED`/`REVERSED` alternatives represented by new facts.

The invariant is:

```text
payout_amount <= settled owner-available balance reserved for that payout
```

Payout does not mean a guest Payment was captured, and a provider “success” callback does not bypass ledger reconciliation. Bank destinations are restricted/tokenized data, never exposed in broad DTOs or logs.

## Consistency and failure ownership

| Interaction                                | Consistency                                      | Failure handling                                                               |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Quote input/rules → PriceQuote             | Deterministic synchronous                        | Reject missing/conflicting versions; never guess a rate                        |
| Reservation → PriceSnapshot                | Strong in Reservation creation/confirmation      | Invalid/expired version rolls back creation or requires re-quote               |
| Reservation → Inventory                    | Strong PostgreSQL allocation transaction         | Constraint/capacity conflict returns unavailable; no partial item/date success |
| Payment provider → Payment                 | Eventual, verified, idempotent                   | Retry/reconcile; provider outage does not mutate Reservation directly          |
| Payment success → Reservation confirmation | Idempotent command with strong inventory reproof | Confirm if allocation valid; otherwise compensate/refund/manual queue          |
| Payment → Finance ledger                   | Durable eventual through outbox                  | Deduplicate source transaction; replay until balanced posting succeeds         |
| Finance → Payout provider                  | Eventual, idempotent                             | Reserved balance remains accounted; retry/reconcile failures                   |
| Source domains → Search/Analytics/Channel  | Eventual                                         | Expose freshness/conflict; never use projection as confirmation authority      |

## Verification required before implementation release

- Property-based/unit tests replay the same canonical Pricing input and prove identical lines/totals/hash.
- Golden tests cover override precedence, weekdays/seasons, min/max stay, CTA/CTD, occupancy, extra guest, promotion stacking, fee/tax ordering, and rounding remainder.
- No authoritative money field or calculation uses JavaScript `number`/floating arithmetic.
- PostgreSQL concurrency tests cover physical overlap, last pooled capacity, all-or-nothing multi-night rows, hold expiry/payment race, and assignment conflicts.
- Payment tests cover duplicate/out-of-order callbacks, signature/replay rejection, amount/currency mismatch, capture after cancellation/expiry, and provider timeout/reconciliation.
- Finance tests prove balanced postings, duplicate-event no-op, refund limit, settlement mismatch isolation, payout available-balance limit, and immutable reversal behavior.
- Tenant-isolation tests attempt cross-tenant pool, rate, reservation, payment, ledger, settlement, and payout references and must fail at application and database boundaries.

## Decisions

### Decision: separate physical-unit exclusion from pooled daily capacity

- **Rationale:** One villa is a unique range-conflict problem; a homestay Room Type is a quantity-per-date problem that may assign a Unit later.
- **Alternatives considered:** One generic availability boolean/table; pre-check then write; cache/distributed lock as authority.
- **Why alternatives were not selected:** They cannot express both invariants atomically or leave race windows and multiple authorities.
- **Use now or later:** Target rule now; implement only the needed mode with its vertical slice, then add the other with the same Inventory contract.
- **Migration path:** Add pool mode and constrained storage, seed/verify daily rows or ranges, run concurrent PostgreSQL tests, then switch booking writes; retain projection/cache as read-only hints.

### Decision: persist immutable deterministic price snapshots

- **Rationale:** Operators, guests, finance, disputes, refunds, and audits must reconstruct the original amount after rates/rules change.
- **Alternatives considered:** Store only final total; recalculate from current rules; persist an unversioned JSON blob.
- **Why alternatives were not selected:** They cannot explain historical totals or guarantee that a replay uses the same inputs/rounding.
- **Use now or later:** Pricing must be deterministic before Reservation implementation; every confirmed Reservation stores the snapshot from its first release.
- **Migration path:** Version rate/restriction/policy inputs, add typed snapshot/line storage, verify golden replay tests, and make later changes append a revision rather than mutate history.

### Decision: use integer money with explicit currency/unit scale

- **Rationale:** Binary floating point can create cent/rupiah drift, broken line sums, excessive refunds, and unbalanced ledgers.
- **Alternatives considered:** JavaScript `number`; formatted decimal strings without an arithmetic policy; database floating types.
- **Why alternatives were not selected:** They either lose precision or leave calculation/rounding ambiguous.
- **Use now or later:** Mandatory from the first Pricing/Payment/Finance schema and API. Provider conversions occur only in adapters.
- **Migration path:** Define/version currency units, serialize integer DTOs as strings, reject ambiguous legacy amounts, and reconcile any migrated value before enabling money movement.

### Decision: isolate provider operations from the financial ledger

- **Rationale:** Provider callbacks describe external execution, while invoices, settlement, fees, refunds, and owner liabilities require durable provider-independent accounting.
- **Alternatives considered:** Store only provider status on Reservation; use provider dashboard as ledger; couple core types to Midtrans/Xendit schemas.
- **Why alternatives were not selected:** They lose history, prevent provider change/reconciliation, and conflate booking with money/accounting state.
- **Use now or later:** Define the port/data separation now. Select and implement a provider only in an approved Payment phase; introduce the ledger before payouts/financial reporting.
- **Migration path:** Add normalized intent/transaction/event records, integrate one adapter with idempotent webhooks, post normalized facts to Finance via outbox, reconcile settlement, then enable payouts after balance controls pass.

## Deferred decisions and deadlines

- Hold TTL, payment guarantee/deposit policy, cancellation products, tax/fee ordering, currency catalog, invoice numbering, retention, refund approval limits, reserve/chargeback policy, payout cadence, and provider selection need named product/legal/finance/operations owners before their implementation phase.
- Midtrans, Xendit, storage, broker, and worker vendors are not selected here.
- Dynamic pricing suggestions/AI are outside the critical path; no automated recommendation may mutate published rates without an authorized, versioned Pricing command and audit evidence.
