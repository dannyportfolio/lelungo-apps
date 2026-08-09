# Proposed domain model

| Domain | State | Ownership and notes |
| --- | --- | --- |
| Tenant | Foundation implemented | Organization/isolation root |
| User / Staff / Role / Permission | Partial | Membership/RBAC exists; authentication adapter absent |
| Property | Planned | Tenant-owned property aggregate |
| Room Type / Room | Planned | Property-owned sellable inventory structure |
| Rate Plan / Availability / Inventory | Planned | Availability and pricing rules; transaction-sensitive |
| Reservation / Reservation Guest | Planned | Booking aggregate and participant link |
| Guest Profile | Planned | Tenant-scoped PII with minimum-field reads |
| Stay / Check-in / Check-out | Planned | Operational lifecycle, separate from reservation state |
| Payment / Invoice / Expense | Planned | Financial records and provider adapters |
| Housekeeping / Maintenance | Planned | Operational tasks and room impact |
| Booking Channel / Direct Booking | Planned | External source adapters and public booking boundary |
| Notification | Planned | Outbox-driven delivery adapters |
| Audit Log | Planned | Append-only actor/action/resource history |
| Report | Planned | Tenant-scoped read models, not cross-module writes |

Every tenant-owned aggregate carries `tenant_id`. Cross-domain references use stable IDs and application services, not direct imports of repository internals. Guest identity and payment fields require explicit data classification before schema creation.
