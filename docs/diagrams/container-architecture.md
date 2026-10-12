# Container architecture

Status: target modular-monolith containers. The repository has a Next.js application plus Prisma schema/migration artifacts; deployment of that database foundation is unverified. Workers, cache, broker, and object storage are deferred.

```mermaid
flowchart TB
  guestWeb[Guest web surface]
  pmsWeb[PMS web surface]
  api[HTTP and BFF boundary]
  modules[Modular application and domain contexts]
  database[(PostgreSQL and Prisma)]
  legacy[(Legacy Supabase click analytics)]
  workers[Background workers - later]
  broker[(NATS JetStream - adoption trigger only)]
  cache[(Cache - measured need only)]
  storage[(Private object storage - later)]

  guestWeb --> api
  pmsWeb --> api
  api --> modules
  modules --> database
  api -. legacy analytics only .-> legacy
  modules -. durable jobs after outbox .-> workers
  workers -. when broker is adopted .-> broker
  modules -. non-authoritative reads only .-> cache
  modules -. media and documents .-> storage
```
