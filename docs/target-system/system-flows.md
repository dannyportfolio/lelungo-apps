# Target system flows

## Query

```text
Request -> input validation -> authentication -> tenant resolution
        -> authorization -> application service -> tenant-scoped repository
        -> minimum-field response
```

## Mutation

```text
Request -> validation -> authentication -> tenant resolution -> authorization
        -> business invariant -> database transaction -> audit/outbox record
        -> response -> asynchronous notification
```

Login authenticates an external identity and then resolves active memberships; choosing a property never changes the tenant authority. Property and room changes validate ownership in the same tenant. Reservation creation locks or atomically validates inventory. Check-in/out and payments are separate state machines with audited transitions. These latter flows are design targets and are not implemented.
