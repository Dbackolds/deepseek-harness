# Agent Note: Repair illegal JSON string literals on OpenAI-compatible SSE

Status: implemented

English | [中文](2026-08-24-openai-sse-json-string-repair.zh.md)

## Problem

A PTC-mode Grok turn fails before any tool runs with `Bad control character in string literal in JSON` or `Unterminated string in JSON`, surfaced as `PI_AI_ERROR` (`PT_AI_ERROR` in the Web UI). The model is emitting `run_code` tool-call `arguments` that contain real newlines, tabs, or an unclosed quote inside a JSON string. The OpenAI SDK parses each SSE `data:` payload with `JSON.parse` and throws; pi-ai flattens that `SyntaxError.message` onto the terminal error event; `classifyPiAiError` does not match it, so the catch-all fires and `llm-retry` does not retry.

pi-ai already repairs some illegal string bytes for *tool-call argument objects* after the SDK has parsed the SSE event. That walker never runs when the *event itself* is not JSON. pi-ai constructs the OpenAI client without a `fetch` hook, so the adapter cannot pass a custom parser into the SDK.

## Decision

- `dsh-llm-pi-ai` repairs OpenAI-compatible SSE JSON on the fetch response body before the SDK reads it.
- `repairJsonStringLiterals` escapes raw C0 controls and invalid backslash sequences inside JSON strings and closes a string that is still open at EOF. `closeUnterminatedJsonContainers` then closes unmatched `{` / `[` so a truncated event becomes a parseable chunk. Already-valid JSON is returned unchanged.
- `createSseJsonRepairStream` buffers until a blank-line event terminator that is not inside a JSON string, rejoins a `data:` payload that a raw newline split, and re-emits one `data:` line.
- Because pi-ai's OpenAI client has no `fetch` option, each adapter stream takes a reference-counted lease on `globalThis.fetch`. Overlapping streams share one wrapper; the last disposer restores the previous `fetch`. Non-SSE responses pass through.
- A payload that is still not JSON after this pass fails the turn as `PI_AI_ERROR`. Partial tool-call arguments from a closed truncated string are validated by the tool executor, not invented into a successful call.

## Alternatives considered

**Patch `@earendil-works/pi-ai` or the OpenAI SDK to call `parseJsonWithRepair` on SSE data.** Rejected: the harness does not own those packages, and a local `pnpm.patchedDependencies` entry would have to be re-applied on every upgrade for one provider defect.

**Classify these `SyntaxError` messages as retryable `TRANSPORT` or `INVALID_REQUEST`.** Rejected: the bytes already arrived; resending the same request reproduces the same illegal JSON. `PI_AI_ERROR` stays the non-retryable catch-all; the fix is to parse the event.

**Ask the model to retry, or tell operators to leave PTC mode.** Rejected as the product fix: Grok 4.6 in code mode regularly embeds real newlines in `run_code` arguments. The wire must accept that output.

**Inject a custom OpenAI client through pi-ai `StreamOptions`.** Rejected: pi-ai 0.82.1 still exposes no `fetch` / client hook on the OpenAI Completions path. Wrapping `globalThis.fetch` for the stream lifetime is the injection point that exists.

## Consequences

- A Grok or other OpenAI-compatible stream whose only defect is illegal JSON string bytes becomes a tool call instead of a turn failure.
- Closing a truncated string can yield a partial argument object; the tool schema, not this walker, rejects it.
- The fetch wrapper is process-wide for the stream lifetime. Tests that stub `globalThis.fetch` must not overlap a live adapter stream in the same isolate; Vitest forks keep unit files isolated.
- pi-ai still owns argument-object repair after the event parses; this layer only makes the event parseable.
