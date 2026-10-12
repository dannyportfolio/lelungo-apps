# 03 — Target bounded contexts

- **Current implementation:** Only Tenancy and initial Identity/RBAC foundations exist as source modules. Their production authentication, database deployment, same-tenant role assignment, and end-to-end isolation are not yet proven.
- **Target state:** A modular monolith whose contexts own data and behavior, expose intentional application contracts, and can be extracted only after evidence-based triggers.
- **Decision status:** Proposed catalog under the accepted modular-monolith and tenant-isolation decisions. Context names/contracts remain target-only until separately specified and implemented.
- **Last verified:** 2026-08-09

> **Target-only artifact.** Commands, queries, events, tables, transaction boundaries, and extraction ranks below are proposed contracts. They are not running endpoints, topics, schemas, or services.

Implemented-boundary evidence is limited to [`src/modules/tenancy`](../../../src/modules/tenancy/tenant-context.ts), [`src/modules/identity`](../../../src/modules/identity/authorization.ts), and the [current architecture](../../current-system/current-architecture.md). The prior target boundary sketch is [proposed-module-boundaries.md](../../target-system/proposed-module-boundaries.md).

## Catalog rules

- A context is a business ownership boundary, not automatically a deployable service.
- A context may read another context's data only through a public query/DTO or a purpose-built projection. It may never import the other context's repository or mutate its tables.
- Events are facts in past tense and carry IDs/versioned minimum payloads, not ORM objects or sensitive provider/guest records.
- `EARLY`, `MEDIUM`, and `LATE` rank future extraction order **after** a trigger is measured; `NEVER/UNNECESSARY` means remain a module by default. `EARLY` never means “create a microservice now.” The canonical evolution analysis is [07-microservice-evolution.md](07-microservice-evolution.md).
- The initial deployment is one application and one PostgreSQL database. In-process application contracts are used first; strong cross-context transactions are explicit extraction constraints.

### Indicative implementation ownership

This catalog does not authorize any phase. [12-phase-roadmap.md](12-phase-roadmap.md) is the canonical dependency/gate plan; the mapping below makes the target timing explicit.

| Target phase               | Contexts/capabilities first eligible for a separately approved slice                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1                    | Authoritative authentication plus same-tenant membership/RBAC integrity only; no new PMS domain                                                     |
| Phase 2                    | Identity administration, Organization/Tenancy reconciliation, Property core, and property scope                                                     |
| Phase 3                    | Room Type/Unit accommodation structure, Inventory, Pricing, and Promotion foundations                                                               |
| Phase 4                    | Reservation, holds, immutable snapshots, idempotency, and the first source-transaction Audit/outbox evidence                                        |
| Phase 5                    | Guest profiles, Stay/front-office lifecycle, assignments, and calendar projection                                                                   |
| Phase 6                    | Guest Payment and Finance ledger/settlement/payout foundations                                                                                      |
| Phase 7+                   | Guest marketplace composition, first Search projection, Notification delivery as needed, and Review only through a separate post-stay specification |
| Phase 8                    | Operations task automation, housekeeping, maintenance, and unit readiness                                                                           |
| Phase 9 / 11               | Distribution/iCalendar first, then one native channel adapter at a time                                                                             |
| Phase 10                   | Analytics/reporting projections                                                                                                                     |
| Deferred independent slice | Platform Billing; it is not a prerequisite to invent inside the PMS transaction flow                                                                |

## 1. Identity & Access

| Field                   | Target contract                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Verify provider-neutral subject context, resolve staff membership, group permissions into roles, enforce organization/property scopes, and deny by default.                         |
| Owned entities/tables   | `staff_memberships`, `roles`, `permissions`, `role_permissions`, `staff_membership_roles`, proposed `membership_property_scopes`; only an opaque external subject ID is retained.   |
| Public commands         | `InviteStaff`, `ActivateMembership`, `SuspendMembership`, `AssignRole`, `RevokeRole`, `GrantPropertyScope`, `RevokePropertyScope`.                                                  |
| Public queries          | `ResolveActiveMembership`, `GetEffectivePermissions`, `ListAuthorizedProperties`, `CanPerform`.                                                                                     |
| Events emitted          | `StaffMembershipActivated`, `StaffMembershipSuspended`, `RoleAssigned`, `RoleRevoked`, `PropertyScopeGranted`, `PropertyScopeRevoked`.                                              |
| Events consumed         | `OrganizationProvisioned`, `PropertyArchived`; verified identity-provider signals enter through an adapter rather than as trusted client events.                                    |
| Dependencies            | Organization/Tenancy for active organization identity; Property for validating same-tenant property scope; external identity adapter for subject verification.                      |
| Transaction boundary    | Membership lifecycle plus its role/scope assignments and audit/outbox evidence. Assignment must prove membership, role, and property scope share the same tenant.                   |
| Consistency             | Strong for authentication/membership/permission checks before protected data access; eventual for access-review reporting.                                                          |
| Extraction trigger/rank | **LATE.** Extract only for independent security ownership, identity workload, or blast-radius isolation, after a stable auth contract and low-latency authorization strategy exist. |

**Current invariant gap:** `staff_membership_roles` has only membership and role foreign keys. It does not enforce that a tenant membership receives a role from the same tenant/scope, and the current joined-role query does not add that filter. A forward constraint/model change plus cross-tenant integration tests is required before this relation is production authorization authority.

## 2. Organization & Tenancy

| Field                   | Target contract                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own the accommodation business/isolation root, lifecycle, trusted domains, organization settings, and tenant-context policy.                                                                                                |
| Owned entities/tables   | Existing `tenants` (business term Organization), `tenant_domains`; proposed `organization_settings` and provisioning history.                                                                                               |
| Public commands         | `CreateOrganization`, `ConfigureDomain`, `ActivateOrganization`, `SuspendOrganization`, `ArchiveOrganization`.                                                                                                              |
| Public queries          | `ResolveOrganizationByDomain`, `GetOrganization`, `GetOrganizationStatus`.                                                                                                                                                  |
| Events emitted          | `OrganizationProvisioningStarted`, `OrganizationProvisioned`, `OrganizationActivated`, `OrganizationSuspended`, `OrganizationArchived`, `TenantDomainChanged`.                                                              |
| Events consumed         | Platform Billing entitlement/suspension decisions where product policy explicitly requires them; it does not accept tenant IDs from clients as authority.                                                                   |
| Dependencies            | Identity & Access for an authenticated onboarding actor; Audit for durable evidence. Property depends on this context, not the reverse for normal writes.                                                                   |
| Transaction boundary    | Organization/domain uniqueness and lifecycle changes. Cross-context onboarding is a retryable provisioning workflow; organization remains `PROVISIONING` until Identity creates the owner membership.                       |
| Consistency             | Strong for domain resolution and organization active/suspended state; eventual for onboarding side effects and downstream projections.                                                                                      |
| Extraction trigger/rank | **NEVER/UNNECESSARY by default.** Small, highly shared authority data should remain local; reconsider only if platform-scale provisioning or a regulatory isolation requirement clearly outweighs a new network dependency. |

## 3. Property

| Field                   | Target contract                                                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own property identity, classification, address/location, timezone, policies, amenities, media metadata, Room Types, and physical Units.                                                                                                                                            |
| Owned entities/tables   | Proposed `properties`, `property_addresses`, `amenities`, `property_amenities`, `property_media`, `property_policies`, `room_types`, `units`. Binary objects remain in object storage; this context owns their metadata.                                                           |
| Public commands         | `CreateProperty`, `UpdatePropertyProfile`, `SetPropertyAddress`, `AttachAmenity`, `AddMedia`, `CreateRoomType`, `CreateUnit`, `ChangeUnitCompatibility`, `PublishProperty`, `ArchiveProperty`.                                                                                     |
| Public queries          | `GetProperty`, `GetPublishedProperty`, `ListOrganizationProperties`, `GetRoomType`, `GetUnit`, `ListCompatibleUnits`.                                                                                                                                                              |
| Events emitted          | `PropertyCreated`, `PropertyUpdated`, `PropertyPublished`, `PropertyArchived`, `RoomTypeChanged`, `UnitCreated`, `UnitChanged`.                                                                                                                                                    |
| Events consumed         | `OrganizationSuspended` to prevent new publication/management while preserving records; media processing result events.                                                                                                                                                            |
| Dependencies            | Organization/Tenancy for ownership; Identity & Access for property-scoped commands; object-storage adapter for media.                                                                                                                                                              |
| Transaction boundary    | One Property aggregate change and its directly owned address/amenity/policy records; unit/room-type changes validate same property/tenant.                                                                                                                                         |
| Consistency             | Strong for ownership, unit identity, and publish prerequisites; eventual for Search, Analytics, and media derivatives.                                                                                                                                                             |
| Extraction trigger/rank | **NEVER/UNNECESSARY by default.** Keep catalog authority local and scale public reads through Search projections. Media processing is a **MEDIUM** extraction capability/worker through the storage adapter if compute workload demands it; it is not a separate business context. |

## 4. Inventory

| Field                   | Target contract                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own sellable capacity, dated availability, holds, confirmed allocations, operational blocks, and conflict-free physical assignments.                                                                                                                      |
| Owned entities/tables   | Proposed `inventory_pools`, `inventory_days`, `inventory_allocations`, `unit_assignments`, `availability_blocks`, inventory idempotency records.                                                                                                          |
| Public commands         | `CreateInventoryPool`, `SetDailyCapacity`, `HoldInventory`, `ConfirmHold`, `ReleaseHold`, `ExpireHold`, `BlockInventory`, `UnblockInventory`, `AssignUnit`, `ReleaseUnitAssignment`.                                                                      |
| Public queries          | `CheckAvailability`, `GetAvailabilityCalendar`, `GetHold`, `ListAssignableUnits`.                                                                                                                                                                         |
| Events emitted          | `InventoryPoolChanged`, `InventoryHeld`, `InventoryHoldExpired`, `InventoryReleased`, `InventoryCommitted`, `InventoryBlocked`, `UnitAssigned`.                                                                                                           |
| Events consumed         | `PropertyArchived`, `UnitChanged`, `ReservationCancelled`, `ReservationNoShowRecorded`, `StayCompleted`, `MaintenanceBlockRequested`.                                                                                                                     |
| Dependencies            | Property for immutable/same-tenant unit compatibility; Reservation invokes its contracts but cannot write Inventory tables.                                                                                                                               |
| Transaction boundary    | All dates/resources of one allocation command. Physical mode uses an exclusion constraint; pooled mode locks all date rows in deterministic order and updates them atomically. Confirmation moves held capacity to sold capacity in the same transaction. |
| Consistency             | **Strong** for availability, holds, allocations, blocks, and assignments. Search/channel availability is eventually consistent and never authoritative.                                                                                                   |
| Extraction trigger/rank | **LATE.** Candidate only when lock/contention load needs independent scaling or many booking channels require isolated availability throughput. Extraction requires a proven synchronous hold API, idempotency, and failure/compensation model.           |

## 5. Pricing

| Field                   | Target contract                                                                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own rate plans, dated rates, restrictions, cancellation-policy versions, deterministic calculation, and short-lived quotes.                                                                    |
| Owned entities/tables   | Proposed `rate_plans`, `rates`, `pricing_rules`, `restrictions`, `cancellation_policies`, `price_quotes`, quote line/input versions. Confirmed reservation snapshots are owned by Reservation. |
| Public commands         | `CreateRatePlan`, `PublishRatePlanVersion`, `SetRate`, `SetRestriction`, `RetireRatePlan`, `CalculateQuote`, `InvalidateQuote`.                                                                |
| Public queries          | `GetRatePlan`, `ValidateRatePlan`, `GetPricingInputs`, `ExplainQuote`.                                                                                                                         |
| Events emitted          | `RatePlanPublished`, `RateChanged`, `RestrictionChanged`, `PriceQuoteCalculated`, `PricingInputsInvalidated`.                                                                                  |
| Events consumed         | `InventoryPoolChanged`, `PropertyTimezoneChanged`, `PromotionPublished`, `PromotionRetired`.                                                                                                   |
| Dependencies            | Property for timezone/capacity attributes; Inventory for availability only when composing a guest quote; Promotion for versioned eligibility/benefit.                                          |
| Transaction boundary    | One rate-plan/rule version publication or one quote calculation persisted with the exact input versions. Calculation never mutates Inventory.                                                  |
| Consistency             | Strong/deterministic for quote calculation and confirmed snapshot inputs; eventual for public price hints and search projections.                                                              |
| Extraction trigger/rank | **LATE.** Extract for independently scaling quote computation, specialist ownership, or rapid rule deployment only after deterministic contracts and cache invalidation are proven.            |

## 6. Reservation

| Field                   | Target contract                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own the commercial booking aggregate, reservation items, source attribution, participant links, immutable confirmed price evidence, and allowed lifecycle transitions.                                                                          |
| Owned entities/tables   | Proposed `reservations`, `reservation_items`, `reservation_guests`, `reservation_state_history`, `reservation_price_snapshots`, `reservation_price_lines`, `booking_sources`, reservation idempotency records.                                  |
| Public commands         | `CreatePendingReservation`, `ConfirmReservation`, `CancelReservation`, `MarkNoShow`, `MarkFulfilled`, `ChangeReservationDates` (implemented as reprice/reallocate, never a blind date update).                                                  |
| Public queries          | `GetReservation`, `GetReservationSummary`, `ListPropertyReservations`, `GetReservationTimeline`, `ExplainReservationPrice`.                                                                                                                     |
| Events emitted          | `ReservationCreated`, `ReservationConfirmed`, `ReservationCancelled`, `ReservationExpired`, `ReservationNoShowRecorded`, `ReservationFulfilled`, `ReservationDatesChanged`.                                                                     |
| Events consumed         | `InventoryHeld`, `InventoryHoldExpired`, normalized `PaymentCaptured`, `PaymentFailed`, `PaymentRefunded`, `StayCompleted`, idempotent channel import commands.                                                                                 |
| Dependencies            | Inventory for strong allocation; Pricing for quote/snapshot input; Guest for minimum participant references; Payment for normalized outcomes; Operations for stay outcome; Distribution only through source/import contracts.                   |
| Transaction boundary    | In the modular monolith, creation/confirmation coordinates Reservation-owned writes and Inventory public transactional commands in one database unit of work, with audit/outbox evidence. No consumer notification/analytics work is inside it. |
| Consistency             | Strong for reservation state, allocation, idempotency, and captured pricing evidence. Eventual for payment reconciliation UI, notifications, analytics, search, and channel propagation.                                                        |
| Extraction trigger/rank | **LATE.** Core workflow and cross-context strong transaction make premature extraction costly. Consider only after sustained booking scale, independent team/deploy needs, and an explicit distributed hold/compensation design.                |

## 7. Guest

| Field                   | Target contract                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own tenant-scoped guest profiles, contact points, consent, sensitive identity references, deduplication policy, retention, and minimum-field disclosure.                                                            |
| Owned entities/tables   | Proposed `guest_profiles`, `guest_contacts`, `guest_identity_records`, `guest_consents`, profile merge/history records. Reservation owns reservation participation links; Operations owns stay participation links. |
| Public commands         | `CreateGuestProfile`, `UpdateGuestContact`, `RecordConsent`, `AttachIdentityRecord`, `MergeGuestProfiles`, `ApplyRetentionAction`.                                                                                  |
| Public queries          | `GetGuestSummary`, `GetGuestContactForPurpose`, `GetSensitiveIdentity` (separate permission), `SearchGuestsWithinTenant`.                                                                                           |
| Events emitted          | `GuestProfileCreated`, `GuestContactChanged`, `GuestConsentChanged`, `GuestProfilesMerged`, `GuestRetentionApplied`.                                                                                                |
| Events consumed         | `ReservationConfirmed` or `StayCompleted` only to update intentional guest history projections, not to copy broad reservation data.                                                                                 |
| Dependencies            | Organization/Tenancy; Identity & Access for purpose/property-scoped permission; private object storage for documents; Audit for sensitive reads.                                                                    |
| Transaction boundary    | One profile and its contact/consent/identity metadata mutation plus audit evidence. Merge retains aliases/history and never silently destroys financial references.                                                 |
| Consistency             | Strong for ownership, access, merge mapping, and retention action; eventual for guest-history/read projections.                                                                                                     |
| Extraction trigger/rank | **LATE.** Extract only for a dedicated privacy boundary, materially distinct retention/encryption infrastructure, or independent guest-account workload.                                                            |

## 8. Payment

| Field                   | Target contract                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Normalize provider payment intents, authorizations, captures, failures, voids, provider events, and refunds without leaking provider schemas into Reservation/Finance.      |
| Owned entities/tables   | Proposed `payment_intents`, `payment_transactions`, `payment_provider_events`, `refunds`, provider-account/reference mappings; no raw credentials.                          |
| Public commands         | `CreatePaymentIntent`, `AuthorizePayment`, `CapturePayment`, `VoidPayment`, `RequestRefund`, `ProcessVerifiedProviderEvent`, `ReconcilePayment`.                            |
| Public queries          | `GetPaymentStatus`, `GetCapturedAmount`, `GetRefundableAmount`, `ListPaymentTransactions`.                                                                                  |
| Events emitted          | `PaymentIntentCreated`, `PaymentAuthorized`, `PaymentCaptured`, `PaymentFailed`, `PaymentVoided`, `RefundRequested`, `PaymentRefunded`, `PaymentReconciliationRequired`.    |
| Events consumed         | `ReservationCreated`, `ReservationCancelled`, `ReservationExpired`, Finance settlement import requests; signed provider callbacks enter through adapters.                   |
| Dependencies            | Reservation through stable reservation/payment-policy references; provider adapters; Finance consumes normalized transactions rather than provider payloads.                |
| Transaction boundary    | Deduplicate one provider event, append normalized transaction(s), update derived intent state, and write outbox/audit atomically. Refund limit is checked under lock.       |
| Consistency             | Strong for idempotency, captured/refunded totals, and provider-reference uniqueness; eventual between provider execution and Reservation/Finance reactions.                 |
| Extraction trigger/rank | **MEDIUM.** Candidate after real provider integration when webhook volume, compliance boundary, secrets, or outage isolation warrants it. It remains in-process until then. |

## 9. Finance

| Field                   | Target contract                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own guest invoices, expenses, double-entry operational ledger, provider settlement, platform/owner fee allocation, and owner payouts.                                                                                                           |
| Owned entities/tables   | Proposed `guest_invoices`, `guest_invoice_lines`, `expenses`, `ledger_accounts`, `ledger_transactions`, `ledger_postings`, `settlements`, `payouts`, payout lines.                                                                              |
| Public commands         | `IssueGuestInvoice`, `PostPaymentAccounting`, `RecordExpense`, `ImportSettlement`, `SchedulePayout`, `MarkPayoutPaid`, `ReverseLedgerTransaction`.                                                                                              |
| Public queries          | `GetGuestInvoice`, `GetReservationBalance`, `GetOwnerAvailableBalance`, `GetSettlement`, `GetPayoutStatement`, `GetFinancialReport`.                                                                                                            |
| Events emitted          | `GuestInvoiceIssued`, `LedgerTransactionPosted`, `SettlementRecorded`, `PayoutScheduled`, `PayoutPaid`, `PayoutFailed`.                                                                                                                         |
| Events consumed         | `ReservationConfirmed`, `ReservationCancelled`, `PaymentCaptured`, `PaymentRefunded`, provider settlement/reversal facts.                                                                                                                       |
| Dependencies            | Payment for normalized money movement; Reservation for immutable commercial references; Organization/Property for account ownership.                                                                                                            |
| Transaction boundary    | One balanced same-currency ledger transaction and its source link; payout scheduling atomically reserves available balance and posts the corresponding balanced ledger entry. It does not mutate Reservation. Corrections use reversal entries. |
| Consistency             | Strong for ledger balance, invoice numbering, settlement allocation, refundable/available balance, and payout limits; eventual from provider events to accounting projections.                                                                  |
| Extraction trigger/rank | **MEDIUM.** Extract for finance-team ownership, accounting/reporting workload, or regulatory isolation after the ledger model and event contracts stabilize.                                                                                    |

Guest Finance must remain separate from Lelungo subscription billing: different customer, invoice sequence, revenue, entitlement, settlement, and payout rules.

## 10. Operations

| Field                   | Target contract                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own actual stays, arrivals/departures, guest-stay participation, housekeeping, maintenance, operational tasks, and unit readiness.                                                                        |
| Owned entities/tables   | Proposed `stays`, `guest_stays`, `housekeeping_tasks`, `maintenance_tasks`, `unit_readiness_history`, general operational-task metadata. Inventory owns capacity blocks and physical assignments.         |
| Public commands         | `PlanStay`, `PrepareArrival`, `CheckInGuest`, `CheckOutGuest`, `CreateHousekeepingTask`, `StartCleaning`, `InspectUnit`, `OpenMaintenanceTask`, `CompleteMaintenanceTask`.                                |
| Public queries          | `GetArrivalList`, `GetDepartureList`, `GetStay`, `GetUnitReadiness`, `ListHousekeepingTasks`, `ListMaintenanceTasks`.                                                                                     |
| Events emitted          | `StayPlanned`, `GuestCheckedIn`, `GuestCheckedOut`, `StayCompleted`, `HousekeepingTaskCreated`, `HousekeepingTaskCompleted`, `UnitReadinessChanged`, `MaintenanceTaskOpened`, `MaintenanceTaskCompleted`. |
| Events consumed         | `ReservationConfirmed`, `ReservationCancelled`, `ReservationNoShowRecorded`, `UnitAssigned`; Inventory block/assignment outcomes.                                                                         |
| Dependencies            | Reservation for confirmed commercial reference; Guest for minimum guest identity; Inventory for assignment/block commands; Property for unit metadata.                                                    |
| Transaction boundary    | One Stay transition and directly caused operational task/audit/outbox. Inventory assignment/block is invoked through an explicit strong command where the transition depends on it.                       |
| Consistency             | Strong for check-in/out guards, unit assignment, and task state; eventual for housekeeping task creation after checkout only if an outbox makes delivery durable.                                         |
| Extraction trigger/rank | **LATE.** Keep local until operational workload/team ownership becomes independent or offline/mobile processing requires a distinct deployment.                                                           |

## 11. Notification

| Field                   | Target contract                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Render versioned templates, apply preferences/purpose, deliver through email/WhatsApp/other adapters, and track attempts without blocking source transactions.                  |
| Owned entities/tables   | Proposed `notification_templates`, `notifications`, `notification_deliveries`, `notification_preferences`, suppression/idempotency records.                                     |
| Public commands         | `QueueNotification`, `RetryDelivery`, `CancelPendingNotification`, `UpdatePreference`.                                                                                          |
| Public queries          | `GetDeliveryStatus`, `ListNotificationHistory`, `GetTemplateVersion`.                                                                                                           |
| Events emitted          | `NotificationQueued`, `NotificationDelivered`, `NotificationFailed`, `NotificationSuppressed`.                                                                                  |
| Events consumed         | Approved events such as `ReservationConfirmed`, `ReservationCancelled`, `PaymentCaptured`, `GuestCheckedIn`; consumers fetch only necessary data through purpose-built queries. |
| Dependencies            | Provider adapters and minimum-field public queries from source contexts; no source transaction depends on delivery success.                                                     |
| Transaction boundary    | Persist one logical notification/idempotency key, then append each provider attempt/result; retries never duplicate the logical notification.                                   |
| Consistency             | Eventual by design. Business transactions complete before delivery; failure is observable and retryable.                                                                        |
| Extraction trigger/rank | **EARLY.** First likely extraction when multi-channel throughput, provider fault isolation, or independent retry scaling appears.                                               |

## 12. Search

| Field                   | Target contract                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility          | Own reconstructable marketplace discovery projections for text, location, amenities, capacity, rating, and non-authoritative price/availability hints. |
| Owned entities/tables   | Proposed PostgreSQL search projection/document tables, geospatial columns/indexes, indexing checkpoints; a dedicated engine is deferred.               |
| Public commands         | `ReindexProperty`, `RemovePropertyFromIndex`, `RebuildProjection`.                                                                                     |
| Public queries          | `SearchProperties`, `SuggestDestinations`, `GetMapResults`.                                                                                            |
| Events emitted          | `SearchProjectionUpdated`, `SearchProjectionFailed`.                                                                                                   |
| Events consumed         | `PropertyPublished`, `PropertyUpdated`, `PropertyArchived`, `RateChanged`, `InventoryUpdated`, `ReviewPublished`.                                      |
| Dependencies            | Event/read DTOs from Property, Pricing, Inventory, and Review; confirmation still calls authoritative Pricing/Inventory.                               |
| Transaction boundary    | Upsert one idempotent projection/version and checkpoint. No transaction spans the source context.                                                      |
| Consistency             | Eventual. Staleness is visible/monitored and cannot authorize booking.                                                                                 |
| Extraction trigger/rank | **EARLY.** Extract/adopt a dedicated search store only when PostgreSQL/PostGIS/index measurements miss latency, relevance, or indexing-SLA targets.    |

## 13. Review

| Field                   | Target contract                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own stay-verified review eligibility, submission, moderation, publication, response, and rating aggregates.                                                                                              |
| Owned entities/tables   | Proposed `review_eligibilities`, `reviews`, `review_moderation`, `review_responses`, rating projection records.                                                                                          |
| Public commands         | `GrantReviewEligibility`, `SubmitReview`, `ModerateReview`, `PublishReview`, `RespondToReview`.                                                                                                          |
| Public queries          | `GetPublishedReviews`, `GetReviewSummary`, `GetModerationQueue`.                                                                                                                                         |
| Events emitted          | `ReviewSubmitted`, `ReviewPublished`, `ReviewHidden`, `RatingAggregateChanged`.                                                                                                                          |
| Events consumed         | `StayCompleted`, `PropertyArchived`, verified moderation outcomes.                                                                                                                                       |
| Dependencies            | Operations for completed-stay evidence; Property for publication target; Guest/Identity for pseudonymous actor authority.                                                                                |
| Transaction boundary    | One review eligibility consumption plus submission, or one moderation/publication transition and outbox.                                                                                                 |
| Consistency             | Strong for one eligible review per policy/stay; eventual for public rating aggregates and Search.                                                                                                        |
| Extraction trigger/rank | **NEVER/UNNECESSARY by default.** Low initial coupling/load favors a module plus read projection; reconsider only for a materially independent trust-and-safety operation or high moderation throughput. |

## 14. Promotion

| Field                   | Target contract                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility          | Own promotion/coupon definitions, eligibility, validity windows, budgets, usage limits, and redemption reservations.                                                                                                           |
| Owned entities/tables   | Proposed `promotions`, `promotion_rules`, `coupons`, `promotion_redemptions`, benefit/version records.                                                                                                                         |
| Public commands         | `CreatePromotion`, `PublishPromotion`, `RetirePromotion`, `ReserveRedemption`, `ConfirmRedemption`, `ReleaseRedemption`.                                                                                                       |
| Public queries          | `EvaluatePromotion`, `GetPromotion`, `GetCouponEligibility`, `GetRemainingBudget`.                                                                                                                                             |
| Events emitted          | `PromotionPublished`, `PromotionRetired`, `PromotionRedemptionReserved`, `PromotionRedeemed`, `PromotionRedemptionReleased`.                                                                                                   |
| Events consumed         | `ReservationConfirmed`, `ReservationCancelled`, `ReservationExpired`; property/rate-plan eligibility changes.                                                                                                                  |
| Dependencies            | Pricing for deterministic application of returned benefit; Reservation for idempotent redemption lifecycle; Property for scope.                                                                                                |
| Transaction boundary    | Reserve/confirm/release one redemption under usage/budget locks. Pricing receives a versioned decision and does not write Promotion tables.                                                                                    |
| Consistency             | Strong for coupon uniqueness, usage count, and finite budget; eventual for campaign analytics.                                                                                                                                 |
| Extraction trigger/rank | **NEVER/UNNECESSARY by default.** Promotion remains a cohesive module; reconsider only if independently measured eligibility traffic/change ownership overwhelms the modular boundary after redemption compensation is stable. |

## 15. Distribution / Channel Manager

| Field                   | Target contract                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own channel accounts, mappings, iCal/native sync, external IDs, import/export checkpoints, retry state, and explicit conflicts.                                   |
| Owned entities/tables   | Proposed `channels`, `channel_accounts`, `channel_mappings`, `external_reservation_refs`, `calendar_sources`, `calendar_sync_runs`, `channel_conflicts`.          |
| Public commands         | `ConnectChannel`, `MapProperty`, `MapInventory`, `ImportCalendar`, `ExportAvailability`, `IngestExternalReservation`, `ResolveChannelConflict`.                   |
| Public queries          | `GetChannelStatus`, `GetMapping`, `ListSyncRuns`, `ListChannelConflicts`.                                                                                         |
| Events emitted          | `ChannelConnected`, `ChannelSyncCompleted`, `ChannelSyncFailed`, `ExternalReservationReceived`, `ChannelConflictDetected`.                                        |
| Events consumed         | `PropertyPublished`, `InventoryUpdated`, `ReservationConfirmed`, `ReservationCancelled`, `RateChanged` when the channel supports it.                              |
| Dependencies            | Property/Inventory mapping queries; Reservation public import command; external channel/iCal adapters. It cannot insert Reservation or Inventory rows directly.   |
| Transaction boundary    | One idempotent external message/sync checkpoint and mapping/conflict update. Reservation creation is a separate authoritative command with its own transaction.   |
| Consistency             | Eventual with external channels. Local double-booking constraints remain strong; conflicts are surfaced rather than silently overwritten.                         |
| Extraction trigger/rank | **MEDIUM.** Provider polling, rate limits, long-running sync, and fault isolation make this a candidate once real channel volume and operational ownership exist. |

## 16. Analytics

| Field                   | Target contract                                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Build tenant-scoped metric facts/aggregates for occupancy, ADR, RevPAR, conversion, operations, and finance without becoming transactional authority.                        |
| Owned entities/tables   | Proposed event ingestion checkpoints, analytics facts, daily/property aggregates, report projections; no source-domain write tables.                                         |
| Public commands         | `RebuildMetricProjection`, `ReprocessEvent`, `CloseReportingPeriod` where required.                                                                                          |
| Public queries          | `GetOccupancyMetrics`, `GetADR`, `GetRevPAR`, `GetBookingSourceMetrics`, `GetOperationalMetrics`.                                                                            |
| Events emitted          | `AnalyticsProjectionUpdated`, `AnalyticsProjectionFailed`.                                                                                                                   |
| Events consumed         | Versioned, minimum events from Reservation, Inventory, Pricing, Payment, Finance, Operations, Distribution, and Review.                                                      |
| Dependencies            | Event contracts and tenant/property metadata projections only. Analytics never participates in source transactions.                                                          |
| Transaction boundary    | Idempotently apply one event/batch and advance its checkpoint; aggregate rebuilds swap or version projections safely.                                                        |
| Consistency             | Eventual by design; reports expose freshness/as-of time. Financial source-of-truth remains Finance.                                                                          |
| Extraction trigger/rank | **MEDIUM.** Read/aggregation workload, warehouse needs, and retention can diverge; extract when OLTP performance or independent data infrastructure demonstrably demands it. |

## 17. Audit

| Field                   | Target contract                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Responsibility          | Own append-oriented security/business action history with actor, tenant, property, target, request/correlation ID, and redacted change metadata.                                                                                                                                                 |
| Owned entities/tables   | Proposed `audit_events` and retention/export checkpoints. Domain-specific financial/state histories stay with their owner contexts.                                                                                                                                                              |
| Public commands         | `AppendAuditEvent`, `RecordSensitiveRead`, `RecordImpersonationStarted`, `RecordImpersonationEnded`, `ExportAuditEvidence`.                                                                                                                                                                      |
| Public queries          | `SearchAuditEvents` with privileged tenant/property scope; `GetResourceAuditTrail`.                                                                                                                                                                                                              |
| Events emitted          | `AuditEvidenceArchived` or retention/export operational events; audit records themselves are not republished indiscriminately.                                                                                                                                                                   |
| Events consumed         | Security and mutation facts from every context, preferably appended in the source transaction or delivered through a transactional outbox.                                                                                                                                                       |
| Dependencies            | Identity actor context, Organization scope, redaction policy, durable PostgreSQL/storage. No business context depends on an asynchronous audit query to authorize work.                                                                                                                          |
| Transaction boundary    | For critical mutations, append audit/outbox evidence atomically with the source write; asynchronous consumer insert is idempotent by source event ID. Records are immutable.                                                                                                                     |
| Consistency             | Strong/same-transaction for privileged/security-critical changes where required; otherwise durable eventual delivery.                                                                                                                                                                            |
| Extraction trigger/rank | **NEVER/UNNECESSARY by default** for the synchronous audit command boundary. Only a central asynchronous audit projection/storage capability is a later **MEDIUM** candidate when immutable retention, compliance isolation, or append/query scale demands it and guaranteed delivery is proven. |

## 18. Platform Billing

| Field                   | Target contract                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsibility          | Own Lelungo's commercial relationship with an Organization: plans, subscriptions, platform invoices/payments, and entitlement signals. It is not guest Payment or owner Finance. |
| Owned entities/tables   | Proposed `subscription_plans`, `subscriptions`, `subscription_invoices`, `subscription_payments`, entitlement history.                                                           |
| Public commands         | `StartSubscription`, `ChangePlan`, `IssueSubscriptionInvoice`, `RecordSubscriptionPayment`, `SuspendEntitlement`, `ResumeEntitlement`.                                           |
| Public queries          | `GetSubscription`, `GetOrganizationEntitlements`, `GetSubscriptionInvoice`.                                                                                                      |
| Events emitted          | `SubscriptionActivated`, `SubscriptionPaymentFailed`, `OrganizationEntitlementChanged`, `SubscriptionCancelled`.                                                                 |
| Events consumed         | `OrganizationProvisioned`; normalized platform-payment provider events through a separately configured account/adapter.                                                          |
| Dependencies            | Organization/Tenancy; Payment provider infrastructure can be shared as code, but accounts, records, ledgers, and idempotency namespaces are isolated from guest payments.        |
| Transaction boundary    | One subscription/invoice/entitlement transition plus outbox/audit. Product policy decides whether delinquency suspends PMS access; it never deletes tenant data.                 |
| Consistency             | Strong for invoice/entitlement state inside the context; eventual propagation to Organization gates with explicit grace/failure policy.                                          |
| Extraction trigger/rank | **LATE.** Keep isolated as a module; extract only for independent SaaS-billing ownership/provider infrastructure. This is outside the initial PMS foundation.                    |

## Cross-context consistency matrix

| Interaction                               | Required model                                                                                                         | Authoritative owner                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Reservation ↔ Inventory hold/confirmation | Strong synchronous transaction in the modular monolith                                                                 | Inventory owns capacity; Reservation owns booking state             |
| Reservation ↔ confirmed pricing evidence  | Strong: exact versioned quote is copied to immutable Reservation snapshot before confirmation                          | Pricing owns calculation rules; Reservation owns confirmed evidence |
| Reservation ↔ Payment                     | Asynchronous provider execution plus idempotent synchronous confirmation command; late success must re-prove inventory | Payment owns money movement; Reservation owns confirmation          |
| Reservation ↔ Notification                | Eventual through outbox/retry                                                                                          | Notification                                                        |
| Reservation ↔ Analytics/Search            | Eventual projections                                                                                                   | Analytics/Search                                                    |
| Reservation ↔ Distribution                | Eventual channel propagation; imports call authoritative Reservation command                                           | Distribution owns sync; Reservation/Inventory own local truth       |
| Checkout ↔ Housekeeping                   | Durable eventual event is acceptable; task creation must be idempotent and observable                                  | Operations                                                          |
| Operations ↔ Inventory block/assignment   | Strong command when check-in/readiness transition depends on the allocation                                            | Inventory owns physical conflict invariant                          |
| Payment ↔ Finance                         | Durable eventual posting/reconciliation with idempotent source transaction IDs                                         | Finance owns ledger                                                 |

## Extraction ranking summary

| Rank                         | Contexts                                                                                                                    | Evidence required before extraction                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| EARLY                        | Notification, Search                                                                                                        | Real delivery/indexing workload, distinct scaling or fault-isolation need, stable contracts, outbox/idempotency, and operational ownership |
| MEDIUM                       | Payment, Distribution, Analytics, Finance; Property media-processing capability; central asynchronous Audit projection only | Proven provider/aggregation/retention/compute pressure and an explicit replay, reconciliation, and failure-ownership plan                  |
| LATE                         | Identity & Access, Inventory, Pricing, Reservation, Guest, Operations/Stay, Platform Billing                                | Independent team/deploy or security/scaling need that outweighs central authority and strong transaction coupling                          |
| NEVER/UNNECESSARY by default | Organization/Tenancy, Property catalog, Promotion, Review, synchronous Audit command boundary                               | Keep as modules/projections unless exceptional measured evidence overturns the default                                                     |

These ranks summarize the canonical service-evolution analysis in [07-microservice-evolution.md](07-microservice-evolution.md). Remaining a disciplined module is an acceptable permanent outcome.

## Decisions

### Decision: bounded contexts are ownership boundaries before service boundaries

- **Rationale:** Lelungo needs data/contract discipline now without network, deployment, observability, and distributed-transaction overhead.
- **Alternatives considered:** One shared service/repository layer; immediate microservice-per-context; database schema access as the integration contract.
- **Why alternatives were not selected:** Shared internals erase ownership, while premature services and database integration create expensive coupling and failure modes before working domains exist.
- **Use now or later:** Apply module ownership and public contracts as domains are introduced. Apply network boundaries only after an extraction trigger is measured.
- **Migration path:** Add one context vertical slice, keep repositories internal, publish application contracts/events, introduce outbox/idempotency, observe, then extract selected contracts without sharing tables.

### Decision: permit only explicit strong cross-context workflows

- **Rationale:** Reservation/inventory and ledger invariants require database correctness, while most fan-out work does not.
- **Alternatives considered:** Eventual consistency for every interaction; one giant transaction spanning notifications/analytics/providers; distributed locks/transactions from day one.
- **Why alternatives were not selected:** Universal eventual consistency can oversell, giant transactions cascade failures, and distributed coordination is unnecessary in one PostgreSQL deployment.
- **Use now or later:** Use local transactions for named correctness invariants now; use outbox-backed events for asynchronous reactions. Reassess when extracting a participant.
- **Migration path:** The extraction proposal must replace each local strong transaction with either a synchronous idempotent contract or a reservation/hold workflow with explicit compensation and failure ownership.

### Decision: extraction rank is conditional, not a roadmap commitment

- **Rationale:** Expected workload suggests likely candidates but does not prove that a service will improve the system.
- **Alternatives considered:** Fixed microservice roadmap; never permit extraction.
- **Why alternatives were not selected:** A fixed roadmap spends complexity speculatively, while a permanent ban prevents responding to real scaling, ownership, or isolation needs.
- **Use now or later:** Record seams and metrics now; decide extraction later with production evidence and an accepted ADR/OpenSpec change.
- **Migration path:** Baseline latency, throughput, contention, failures, ownership, and deployment coupling; run an extraction readiness review; then migrate contracts/data incrementally with dual-run/reconciliation where needed.
