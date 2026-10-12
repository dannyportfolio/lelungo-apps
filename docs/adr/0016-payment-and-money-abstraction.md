# ADR 0016: Payment and money abstraction

Status: Accepted

## Context

Guest charges, refunds, settlement allocation, platform fees, and owner payouts must be exact and auditable. JavaScript floating point and provider-specific payloads are unsafe domain representations.

## Decision

Represent money as an integer amount in the currency's smallest supported unit plus an explicit ISO currency code. Arithmetic rejects currency mismatches. Persist immutable or append-oriented payment transaction attempts and keep the reservation's final pricing snapshot and financial line items sufficient to explain the total.

The Payment context owns provider-neutral payment intents, provider events, authorization/capture/void transaction records, and refunds. The Finance context separately owns guest invoices, balanced ledger postings, provider settlement allocation, operational platform/owner fees, and owner payouts. Platform Billing owns Lelungo's SaaS subscription invoices and payments and never shares guest-payment records or idempotency namespaces. Provider adapters translate at the infrastructure boundary; provider payloads and credentials do not enter core domain models.

## Alternatives

- JavaScript number amounts with decimals: rejected due rounding and reconstruction risk.
- One mutable payment status row: rejected because retries, partial refunds, reconciliation, and provider evidence would be lost.
- Couple the domain directly to the first provider: rejected because provider lifecycle and schemas are integration concerns.

## Consequences

Currency, rounding, tax, settlement, fee, refund, payout, and idempotency policies must be explicit. Payment-to-Finance integration uses normalized append-oriented facts and stable source transaction IDs; neither context mutates the other's tables. Reconciliation retains provider references without storing secrets or sensitive card data.

## Migration Impact

The first Pricing implementation may introduce the shared money primitive in its own approved change. Payment and Finance tables plus a provider are deferred to the approved payment/financial phase after reservation and pricing contracts exist. Provider rollout is additive behind a port, with sandbox and duplicate-callback tests before production use.
