# Infrastructure architecture

```text
User -> CDN/Edge -> Next.js deployment -> modular application -> PostgreSQL
                                      -> object storage (when specified)
                                      -> cache/jobs/external services (when justified)
```

- Development: local Node.js and optional local PostgreSQL; secrets in ignored files.
- Staging: production-like database and isolated credentials; migration rehearsal and smoke tests.
- Production: managed Next.js-compatible compute, managed PostgreSQL with PITR/backups, least-privilege credentials, TLS, and deployment logs.
- Cache: none by default. Add only for measured read pressure; never as authority for inventory/reservation state.
- Jobs: start with a transactional outbox and managed worker/queue only when asynchronous work exists.
- Scheduling: platform scheduler invokes authenticated, idempotent handlers; no scheduler is currently configured.
- Storage: managed object storage with private objects and signed access when guest/property files are introduced.
- Observability: structured logs, error tracking, metrics, audit logs; AI traces remain a separate Langfuse concern.
- Recovery: automated database backups, restore drills, backward-compatible releases, and documented application rollback.
