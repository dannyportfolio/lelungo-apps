# ADR 0009: Model routing strategy

Status: Proposed

## Context
Agent work may need cloud quality, local privacy, fallback, and cost control without coupling the repository to one model.

## Decision
Keep active OpenCode config provider-neutral. Optionally route through external 9Router to OpenRouter or local OpenAI-compatible vLLM/Ollama endpoints. Select models by task and data policy.

## Consequences
Providers can change independently; gateway availability, privacy, and route quality must be monitored outside the application.

## Rejected Alternatives
Hardcoded provider credentials/models and embedding gateway dependencies into the PMS runtime.
