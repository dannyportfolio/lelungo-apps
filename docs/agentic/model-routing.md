# Model routing strategy

The PMS application never calls the coding-agent gateway. Routing is development infrastructure.

## Preferred cloud path

```text
OpenCode -> 9Router OpenAI-compatible endpoint -> OpenRouter -> selected providers
```

9Router centralizes route selection and fallback. OpenRouter aggregates cloud providers. Before enabling the example config, query the gateway `/v1/models`, select an approved route, set credentials outside the repository, and review whether source code may leave the environment.

## Optional local path

```text
OpenCode -> 9Router -> vLLM or Ollama OpenAI-compatible endpoint
```

Use local inference for repository summaries, classification, embeddings, privacy-sensitive lightweight tasks, or offline fallback only when model quality is adequate. Neither vLLM nor Ollama is an application dependency or required developer setup.

Route by task risk, model capability, privacy, latency, and cost. Complex architecture, security, migration, and cross-module work requires a model demonstrated to handle the task; fallback must not silently reduce quality below that bar.
