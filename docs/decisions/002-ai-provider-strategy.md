# ADR 002 — AI provider strategy for blueprint explanation

**Status:** Accepted
**Date:** 2026-05-12

## Context

The blueprint generator needs an LLM layer to produce natural-language
explanations (stack rationale, tradeoffs, "why not" for alternatives,
implementation roadmap) on top of the deterministic rules engine. The
rules engine remains the source of truth for compatibility scoring — the
AI layer is purely additive and must have a fallback for every call.

Requirements:

1. **Every AI call has a deterministic fallback.** A broken or slow
   provider must never break the blueprint response.
2. **Every AI response is Zod-validated.** Model hallucinations must not
   propagate into the public API surface.
3. **Provider is pluggable** via env config so we can swap providers
   without changing route code.
4. **No third-party telemetry** of user ideas beyond the AI provider's
   standard terms — we don't forward prompts to any secondary service.

## Decision

Two first-class providers, one abstraction:

| Provider | Use | Library |
|---|---|---|
| `heuristic` | Default, deterministic, no network | In-process |
| `gemini` | Google Generative AI | `@ai-sdk/google` |
| `azure-openai` | Azure AI Foundry (gpt-5.5, gpt-4.1, etc.) | `@ai-sdk/azure` |

All three implement `BlueprintExplainer` with the same four methods:
`explainStack`, `summarizeTradeoffs`, `explainWhyNot`, `generateRoadmap`.
AI providers are wrapped in `FallbackExplainer` which catches errors on
every call and returns the heuristic result instead.

### Why Azure OpenAI as the primary AI provider

- The Stackfast operator already runs an Azure AI Foundry resource
  with `gpt-5.5` and `gpt-4.1` deployments.
- Azure's deployment model means the "model name" is customer-chosen;
  we accept it as an env var (`AZURE_OPENAI_DEPLOYMENT`) rather than
  hardcoding a model ID.
- The Vercel AI SDK's `@ai-sdk/azure` package uses the same
  `generateText` contract as `@ai-sdk/google`, so the provider classes
  are nearly identical.

### Why keep Gemini

- Lower-cost option for local development / CI smoke tests.
- Provides redundancy: if Azure has an outage the operator can flip
  `AI_PROVIDER=gemini` without a code change.

### Why not OpenAI (direct, non-Azure)

- Stackfast's target operator profile already has Azure OpenAI access.
- Adding a third live provider doubles the surface area that has to be
  maintained (separate auth, rate limits, terms) for no incremental
  quality gain over Azure's `gpt-5.5`.
- The SDK dependency can be added later if needed; it's a one-file
  addition following the same pattern as the Azure provider.

### Why not Anthropic

- Same rationale as direct OpenAI. Revisit in v1.x if evaluation shows
  Claude meaningfully outperforms on structured JSON for this domain.

## Consequences

**Positive**

- Blueprint responses never fail due to provider errors.
- Zod schemas at the provider boundary keep the rest of the system
  from having to trust model output.
- Operator can switch providers with two env vars, no redeploy of code.

**Negative**

- Two live providers means two SDK dependencies and two sets of
  integration issues to track. Mitigated by both living behind the
  same `BlueprintExplainer` interface.
- Static cost estimates still live in `packages/ai/cost-estimator.ts`.
  They're good enough for MVP but will need a real data source for
  v1.x.

## Configuration

```bash
# Pick a provider
AI_PROVIDER=azure-openai   # or "gemini" or "heuristic"

# Azure OpenAI
AZURE_OPENAI_RESOURCE_NAME=your-foundry-resource
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-5.5
# optional
AZURE_OPENAI_API_VERSION=

# Gemini
GEMINI_API_KEY=...
AI_MODEL=gemini-2.5-flash   # optional override
```

A missing key or deployment name for the selected provider falls back to
the heuristic explainer at startup with a warning log. The API never
fails closed on AI configuration.
