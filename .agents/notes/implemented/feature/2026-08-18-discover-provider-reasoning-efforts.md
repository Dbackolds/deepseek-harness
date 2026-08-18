# Agent Note: Discover provider reasoning efforts

Status: implemented

English | [中文](2026-08-18-discover-provider-reasoning-efforts.zh.md)

## Problem

A hand-declared pi-ai model has no selectable thinking levels until its `reasoningEfforts` field is written. The Models page can already fetch ids and capacities from `GET /models`, but that reply dropped any effort metadata a gateway actually advertised. Users who added Grok 4.6 through FAC therefore saw a model picker with no effort pane, and the only remedy was editing `$DSH_HOME/settings.yaml` by hand.

## Decision

Interrogation keeps the same one-shot, nothing-is-stored posture from [[2026-08-04-draft-provider-endpoint-interrogation]]. `LlmDiscoveredModel` and the `llm.discoverModels` wire view gain two optional fields: `reasoningEfforts` (selector id → wire spelling; `off` may be `null`) and `supportsReasoningEffort`. The service drops unknown level ids, empty keys, and empty wire spellings rather than inventing a declaration.

`dsh-llm-pi-ai` fills those fields from two sources. A catalog route still answers from the installed registry, now including each model's supported thinking levels and any catalog `compat.supportsReasoningEffort`. A gateway listing is read for `reasoningEfforts`/`reasoning_efforts` and `supportsReasoningEffort`/`supports_reasoning_effort`. A string token, or an object's `value`/`id`/`name`/`label`, is kept only when it names a known pi-ai level; an unknown wire spelling can still land when a known level label sits beside it.

Adopting a newly fetched row writes the disclosed dict as the model's `reasoningEfforts` and, when the listing said so, `compat.supportsReasoningEffort`. Rechecking an existing row fills those fields only when the row still has no thinking-level declaration; a later fetch does not overwrite a hand-tuned one. The composer effort pane is unchanged: it already offers whatever `resolveModelInfo` reports.

## Alternatives considered

**Guess Grok 4.6 efforts from the model id.** Would have unblocked this one FAC card without a wire change. Rejected: other gateways disagree about which levels they accept, and a guessed `off` on a model that cannot turn thinking off is the lie [[2026-08-03-pi-ai-declared-provider-catalog]] already refused.

**Expose a Models-page editor for `reasoningEfforts`.** Symmetric with the image-input checkbox. Rejected for this change: the provider already publishes the offer, so the missing step was reading it. A hand editor remains YAML, as [[2026-08-08-pi-ai-per-model-reasoning-declarations]] left it.

**Probe a live completion to see which `reasoning_effort` values the endpoint accepts.** Would work for listings that disclose nothing. Rejected: it is several mutating requests against a caller-chosen URL, and a refused value is not a reliable map of supported ones.

## Consequences

Fetching FAC or another OpenAI-compatible gateway that advertises thinking levels now produces a composer effort pane after Apply, with no YAML edit. A listing that still discloses only ids stays silent, and those models keep offering no effort control. Unknown tokens never become profile keys the adapter would later refuse.

## Testing

`packages/llm/llm/tests/topology.spec.ts` keeps a disclosed dict and drops empty keys and empty wire spellings. `packages/llm/llm-pi-ai/tests/discovery.spec.ts` reads camelCase and snake_case listing fields, drops unknown tokens, maps a known label beside an unknown wire value, and reports catalog-route efforts without a network call. `packages/host/apiproxy/tests/api-proxy-config.spec.ts` carries the new fields over the RPC. `packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` writes adopted efforts and `compat.supportsReasoningEffort` while leaving an already-tuned row untouched.
