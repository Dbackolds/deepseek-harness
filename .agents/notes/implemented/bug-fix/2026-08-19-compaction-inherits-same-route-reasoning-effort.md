# Agent Note: Compaction inherits the conversation's same-route reasoning effort

Status: implemented

English | [中文](2026-08-19-compaction-inherits-same-route-reasoning-effort.zh.md)

## Problem

Automatic compaction issues a one-shot `ctx.llm.stream()` call with `purpose: 'compaction'`. That call copies the conversation's provider, model, system prompt, tools, and shadowed messages so the provider's prefix cache can be reused, but it names no `reasoningEffort`.

On `openai-responses`, a declared reasoning model with no selected effort serializes `reasoning.effort` from the model's `off` mapping. A profile that maps `off` to `none` sends `effort: "none"`. Gateway-backed GPT-5.6 models reject that payload with HTTP 400 `invalid_request_error` / `Upstream rejected the request`. The conversation request on the same route with `xhigh` succeeds, so pressure stays above threshold, compaction retries, and a later conversation turn can fail the same way once the unreclaimed history plus new input no longer fits.

The failing YeJiAuth session `session-4f5ac887-1b6f-4cd8-96ff-07d5000638d1` logged 88 `compaction/end` errors with that exact 400, while its conversation `request/header` carried `mqj-gpt` / `gpt-5.6-sol` / `reasoningEffort: "xhigh"`.

## Decision

`summarizeWithLlm()` copies same-route `reasoningEffort` after resolving the summarizer provider/model. The source is the latest logged request header when that header used the summarizer's provider/model pair; otherwise `AgentOptions.reasoningEffort` on the same pair. A configured or otherwise different summarizer route leaves effort unset so the new model's adapter default applies. `prepareCall()` still refuses an unsupported id before provider I/O.

Session-title auxiliary calls stay on their own purpose path. The DeepSeek adapter already disables thinking for `purpose: 'session-title'`; other adapters own that purpose.

This is the same same-route rule as [in-process subagent inheritance](2026-08-19-subagent-inherits-parent-reasoning-effort.md), applied to the compaction summarizer rather than a child agent.

## Alternatives considered

**Have pi-ai omit `reasoning.effort` on `openai-responses` when no effort is selected.** Rejected as the wrong owner: the conversation already selected an explicit effort, and a same-route summarizer must send that same request. Omitting the field would still drop `xhigh` even if the gateway accepted the request.

**Force summarizer effort to `off`.** Rejected because a profile that maps `off` to `none` is exactly the failing payload, and a same-route summarizer is meant to reuse the conversation prefix rather than invent a second thinking mode.

**Copy the conversation effort even after a summarizer model change.** Rejected because effort ids are adapter-owned and model-specific. Carrying `xhigh` onto a model that does not advertise it fails `UNSUPPORTED_REASONING_EFFORT` before compaction can land.

## Testing

`packages/compaction/compaction-basic/tests/compaction-basic.spec.ts` asserts that a same-route logged `xhigh` reaches the summarizer call and that a configured different summarizer route drops it. `packages/llm/llm-pi-ai/tests/adapter.spec.ts` asserts that an `openai-responses` model with `off: none` sends `reasoning.effort: "none"` when no effort is selected and `xhigh` when that id is named.

No new keyless snapshot is added: the shipped examples do not compose this gateway profile, and the defect is the missing inherited field on the summarizer `GenerateOptions`, which the focused tests now pin.

## Consequences

Same-route automatic compaction now sends the conversation's selected effort, so a Web session on `gpt-5.6-sol` / `xhigh` no longer produces a summarizer request that serializes `effort: "none"`. A different summarizer route still leaves effort unset. Callers that already override `AgentOptions.reasoningEffort` keep that override for same-route fallback.
