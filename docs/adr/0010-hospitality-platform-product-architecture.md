# ADR 0010: Hospitality platform product architecture

Status: Accepted

## Context

The current application is an affiliate deal-discovery prototype. The approved product direction combines a first-class multi-property PMS for Indonesian villa and homestay operators with a direct-booking marketplace. Detailed target designs must not imply that either surface is implemented.

## Decision

Build two product surfaces over intentional shared domain services: a public guest booking surface and a separately secured operator PMS surface. Property identity, inventory, pricing, reservation, guest, and payment capabilities have one authoritative owner each; the marketplace does not create a second inventory or booking engine. Exact hostnames and any central PMS organization-selection flow remain deferred: until a later routing/security decision is accepted, the existing tenancy ADR's server-authoritative tenant-host resolution remains controlling and no browser-supplied organization ID establishes authority.

The initial deployment remains one Next.js modular monolith and one PostgreSQL transaction store. Destination modeling is geographic and extensible across Indonesia rather than hard-coded to launch cities.

## Alternatives

- Keep Lelungo as an outbound affiliate site: rejected because it cannot provide direct inventory, reservation, or operator workflows.
- Build a PMS without a marketplace: rejected as the long-term product direction, while still allowing PMS slices to ship first.
- Build two independent applications with duplicated data: rejected because it creates inconsistent inventory, pricing, and reservation authority.

## Consequences

Shared business invariants stay consistent across operator and guest experiences. Product delivery must sequence foundations and PMS correctness before direct booking, transport/UI concerns must not own domain rules, and a proposed hostname must not be mistaken for an authorized tenant-resolution design.

## Migration Impact

Retain the working prototype during incremental replacement. Introduce new domain slices behind explicit services, route new surfaces to them, deprecate affiliate concepts only after replacement evidence, then remove legacy data and integrations in separately approved changes.
