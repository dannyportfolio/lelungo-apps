# Agentic engineering workflow

```text
Developer
  -> OpenCode (primary daily runtime)
    -> AGENTS.md + OpenSpec + ADR + current/target docs
      -> optional 9Router
        -> OpenRouter or approved local inference
          -> scoped implementation
            -> local verification + CI
              -> session handoff
```

Begin in plan mode. Discovery is read-only. Material work requires a specification, explicit non-goals, migration/rollback analysis, and approval appropriate to the change. Implementation remains small, tests are risk-based, and tool output—not agent confidence—is verification evidence.

OpenCode is installed on the workstation but the repository does not mandate a global version. The active `opencode.jsonc` contains no provider credentials or hardcoded model. Optional routing is copied from the example only after gateway policy and available model IDs are verified.
