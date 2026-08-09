# ADR 0008: Agentic development workflow

Status: Accepted

## Context
AI agents need bounded, repeatable context and verification rather than hidden memory.

## Decision
Use OpenCode as primary runtime, OpenSpec for material changes, AGENTS.md for guardrails, ADRs for durable decisions, CI for evidence, and session handoffs for continuity.

## Consequences
Work is reviewable and portable across agents; documentation discipline adds deliberate overhead.

## Rejected Alternatives
Prompt-only workflows, unrestricted autonomous edits, and provider-specific repository logic.
