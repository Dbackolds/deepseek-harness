# Agent Note: Per-model system prompt replacement

Status: implemented

English | [中文](2026-08-15-per-model-system-prompt.zh.md)

## Problem

The deployment persona is one process-wide template. A catalog that mixes models with different instruction needs — a terse coder beside a verbose reviewer, or a gateway model that already carries its own identity — cannot give each model its own complete system prompt without a new agent preset or a hand-edited composition overlay.

## Decision

Each adapter catalog entry may carry an optional `systemPrompt` string. Absence or whitespace leaves ordinary system-prompt assembly unchanged. A non-empty value is the complete system-prompt template for that exact model id: `agent-loop` replaces every assembled system section with that text after the existing strict `{{variable}}` interpolation.

The field travels as `LlmResolvedModelInfo.systemPrompt`. `LlmRuntime.resolveModelInfo` forwards a string and drops an empty one; a non-string value fails with `INVALID_MODEL_SYSTEM_PROMPT`. DeepSeek stores the field on the catalog entry and exposes it only for a listed id. pi-ai cannot attach it to the upstream `Model`, so resolution keeps a `configuredSystemPrompts` map beside `configuredMaxTokens`; both `models` and `modelOverrides` write into that map.

Replacement happens on `system-prompt/assemble` after `next()`. Tool schemas, runtime-context snapshots, and prompt variables stay. A scoped `complete` persona is restored after the waterfall, so an agent-scoped complete identity still wins over a catalog prompt.

The Models settings editors expose the field as a full-width textarea behind each row's disclosure. Clearing the textarea unsets the field rather than storing an empty string.

## Alternatives considered

**Append a model-owned section beside the deployment persona.** That would leave harness identity and tool guidance in place. The requested product behavior is a replaceable system prompt, not an extra paragraph.

**Replace only `deployment:persona`.** That would keep harness identity and tool sections. A model that already owns its identity would still receive those openers.

**Put the field on `system-prompt` config keyed by provider/model.** That would split model identity across two settings namespaces. The catalog entry already names the model the request will use.

**Let adapters inject the prompt at stream time.** That would hide the replacement from `request/header` reconstruction and from prompt-inspection tools. Assembly remains the one place that owns system text.

## Consequences

A listed model can own its entire system prompt without a new preset. Unlisted DeepSeek pass-through ids keep ordinary assembly until they are added to the catalog. Late-bound routes that appear only in `agent/request` still follow `AgentOptions`, matching the existing `{{model}}` variable. Changing a model's `systemPrompt` invalidates prefix cache from the first system token of the next request that uses that model.

## Testing

Package tests pin schema resolution, empty-string drop, `resolveModelInfo` forwarding, agent-loop replacement, complete-persona precedence, and both Models editors writing and unsetting the field. The keyless headless DeepSeek-defaults snapshot sends a catalog `systemPrompt` through the one-shot app and asserts the wire `system` message.
