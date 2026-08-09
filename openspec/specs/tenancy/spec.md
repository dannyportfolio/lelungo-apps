# Tenancy specification

## Purpose

Define the trusted tenant resolution and scoping guarantees that prevent one tenant from establishing authority over another tenant's data.

## Requirements

### Requirement: Trusted wildcard-subdomain resolution

The system SHALL normalize a request hostname against configured production or explicitly enabled local root domains and SHALL reject reserved, malformed, or unrelated hosts as tenant identifiers.

#### Scenario: Valid production tenant host

- **WHEN** a request hostname is `merapi.lelungo.com` and the root domain is `lelungo.com`
- **THEN** the normalized tenant subdomain is `merapi`

#### Scenario: Unrelated or reserved host

- **WHEN** a hostname is outside the configured root or its first label is reserved
- **THEN** no tenant subdomain is resolved

### Requirement: Server-side tenant authority

The system MUST resolve the normalized subdomain to an active tenant on the server and MUST NOT treat a client-supplied tenant ID as authority.

#### Scenario: Tenant-scoped repository access

- **WHEN** an application service reads tenant-owned data
- **THEN** it supplies trusted tenant context to a tenant-scoped repository method
