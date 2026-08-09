# MCP policy

MCP servers are disabled by default in `opencode.jsonc`.

| MCP | Purpose | Allowed actions | Forbidden actions | Use when | Do not use when |
| --- | --- | --- | --- | --- | --- |
| GitHub | PR/issues/check context | Read metadata/diffs; write only with explicit request | Silent commit/push/merge | Repository work needs remote evidence | Local files answer the question |
| Database inspector | Schema/query evidence | Read schema, explain plans, disposable test DB | Production writes or secret extraction | Migration/performance validation | Static schema is sufficient |
| Browser testing | UI and flow evidence | Local/preview navigation and screenshots | Production mutation without authorization | User flow requires runtime proof | Unit/API test is sufficient |
| Documentation | Current primary docs | Read authoritative product/tool docs | Bulk context ingestion | Version-sensitive APIs are needed | Repository docs already decide it |
| Deployment platform | Deploy/log evidence | Read state; mutate only when requested | Unapproved production deploy/rollback | Deployment task explicitly needs it | Coding or local verification |

Enable the minimum server for one task, use least-privilege credentials, restrict paths/actions, and disable it afterward. Never expose secrets or guest/payment/identity/property-sensitive data to an MCP without an approved data policy.
