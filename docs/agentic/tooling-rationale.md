# Tooling rationale

## OpenCode

Tool: OpenCode  
Fungsi: terminal-centric coding-agent runtime.  
Kenapa dipilih: configuration-as-code, project instructions, permissions, subagents, and provider abstraction match the repository workflow.  
Posisi: developer entry point.  
Digunakan kapan: discovery, scoped implementation, refactor, test, and review.  
Tidak perlu digunakan kapan: ordinary runtime or deployment.  
Alternatif: Codex, Claude Code, Cline, Roo Code.  
Trade-off: requires careful permissions and maintained context.

## 9Router

Tool: 9Router  
Fungsi: optional OpenAI-compatible routing, fallback, and centralized model endpoint.  
Kenapa dipilih: separates agent configuration from individual providers.  
Posisi: between OpenCode and cloud/local providers.  
Digunakan kapan: multiple routes or fallbacks are operated.  
Tidak perlu digunakan kapan: one directly configured provider is adequate.  
Alternatif: direct OpenRouter/provider endpoint or another governed gateway.  
Trade-off: adds a local/control-plane dependency and another trust boundary.

## OpenRouter

Tool: OpenRouter  
Fungsi: cloud-model aggregation through an OpenAI-compatible API.  
Kenapa dipilih: broad provider access and fallback without repository coupling.  
Posisi: upstream of 9Router or directly behind OpenCode.  
Digunakan kapan: approved cloud models are needed.  
Tidak perlu digunakan kapan: direct enterprise provider or local inference is required.  
Alternatif: direct model-provider APIs.  
Trade-off: third-party data handling, cost, latency, and provider availability.

## vLLM

Tool: vLLM  
Fungsi: high-throughput local/self-hosted model serving.  
Kenapa dipilih: optional OpenAI-compatible private inference for capable hardware.  
Posisi: local upstream behind the router.  
Digunakan kapan: sustained local workloads justify GPU operations.  
Tidak perlu digunakan kapan: workstation resources or model quality are insufficient.  
Alternatif: Ollama or governed cloud endpoint.  
Trade-off: GPU, model, patching, and operational responsibility.

## Ollama

Tool: Ollama  
Fungsi: optional lightweight local model runtime.  
Kenapa dipilih: simple local experimentation and offline fallback.  
Posisi: external developer tool, never a PMS dependency.  
Digunakan kapan: low-risk lightweight tasks fit an available local model.  
Tidak perlu digunakan kapan: complex/security-sensitive work or no adequate model.  
Alternatif: vLLM or cloud models.  
Trade-off: variable model quality and workstation resource use.

## OpenSpec

Tool: OpenSpec  
Fungsi: proposal/design/spec/task/verification lifecycle.  
Kenapa dipilih: makes intent and deltas durable in a brownfield repository.  
Posisi: before and alongside material implementation.  
Digunakan kapan: features, architectural changes, migrations, and material refactors.  
Tidak perlu digunakan kapan: trivial typo with no behavioral impact.  
Alternatif: hand-maintained RFC templates.  
Trade-off: authoring overhead and generated agent files.

## MCP

Tool: Model Context Protocol servers  
Fungsi: scoped access to external systems.  
Kenapa dipilih: standardized tool boundary when local evidence is insufficient.  
Posisi: optional agent capability.  
Digunakan kapan: GitHub, database, browser, docs, or deployment evidence is required.  
Tidak perlu digunakan kapan: repository/CLI already answers the task.  
Alternatif: official CLI/API or manual inspection.  
Trade-off: schema/context growth, credentials, and external-action risk.

## Langfuse

Tool: Langfuse  
Fungsi: AI trace, prompt, token, latency, evaluation, and cost observability.  
Kenapa dipilih: only if Lelungo later operates an AI workflow needing traceability.  
Posisi: AI execution observability, separate from application requests.  
Digunakan kapan: production AI features or agent automation warrant it.  
Tidak perlu digunakan kapan: ordinary PMS CRUD and current coding sessions.  
Alternatif: provider telemetry or OpenTelemetry-compatible AI traces.  
Trade-off: telemetry privacy, retention, cost, and integration work.

## Qdrant

Tool: Qdrant  
Fungsi: vector search for RAG/semantic retrieval.  
Kenapa dipilih: only when measured semantic retrieval requirements exist.  
Posisi: optional retrieval index, never transactional authority.  
Digunakan kapan: approved document search, embeddings, or semantic memory.  
Tidak perlu digunakan kapan: PMS relational queries or repository source of truth.  
Alternatif: PostgreSQL pgvector or provider search.  
Trade-off: another data store, synchronization, privacy, and operations.

## GitHub and CI/CD

Tool: GitHub and GitHub Actions  
Fungsi: source collaboration and automated quality gates.  
Kenapa dipilih: workflow already exists and is repository-native.  
Posisi: review and merge boundary.  
Digunakan kapan: every pull request and main-branch change.  
Tidak perlu digunakan kapan: isolated local exploration only.  
Alternatif: GitLab/Bitbucket and their runners.  
Trade-off: hosted-runner trust, minutes, and workflow maintenance.

## Testing tools

Tool: Vitest and Playwright  
Fungsi: fast unit tests and browser-level flow verification.  
Kenapa dipilih: fit the TypeScript/Next.js stack and existing tests.  
Posisi: local and CI verification.  
Digunakan kapan: pure rules/boundaries and critical user flows respectively.  
Tidak perlu digunakan kapan: tests cannot add meaningful risk evidence.  
Alternatif: Node test runner, Jest, Cypress.  
Trade-off: browser timing/runtime cost and test maintenance.

## Deployment tools

Tool: Next.js-compatible managed deployment (Vercel is a candidate)  
Fungsi: web build, CDN/edge, preview, and server execution.  
Kenapa dipilih: matches the current framework; no platform commitment is verified yet.  
Posisi: application hosting.  
Digunakan kapan: staging/production environments are approved.  
Tidak perlu digunakan kapan: local development.  
Alternatif: container hosting or another Next.js-compatible platform.  
Trade-off: platform coupling, pricing, runtime limits, and data region.

## Database tools

Tool: PostgreSQL and Prisma  
Fungsi: transactional persistence and typed schema/migrations.  
Kenapa dipilih: relational constraints and transactions suit PMS inventory, reservations, and finance.  
Posisi: modular-monolith persistence boundary.  
Digunakan kapan: tenant and future business data.  
Tidak perlu digunakan kapan: ephemeral cache, blobs, or semantic search.  
Alternatif: SQL query builder/ORM over PostgreSQL.  
Trade-off: migration discipline, connection management, and ORM query review.
