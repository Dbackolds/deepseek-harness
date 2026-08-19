# Agent Note: In-process subagents inherit the parent's same-route reasoning effort

Status: implemented

English | [中文](2026-08-19-subagent-inherits-parent-reasoning-effort.zh.md)

## Problem

A Web parent session carries its selected reasoning effort through `installModelSelection` and logs it on `request/header`. In-process children inherit only `provider`, `model`, and `maxTokens`. Their first request therefore names no effort.

On `openai-responses`, a declared reasoning model with no selected effort serializes `reasoning.effort` from the model's `off` mapping. A profile that maps `off` to `none` sends `effort: "none"`. Gateway-backed GPT-5.6 models reject that payload with HTTP 400 `invalid_request_error` / `Upstream rejected the request` on the child's first turn, while the parent on the same route with `xhigh` succeeds.

## Decision

`AgentOptions.reasoningEffort` is a first-class creation option. Agent Loop seeds it into the first `LlmCallConfig` when no same-route logged effort exists, then still lets `prepareCall()` refuse an unsupported id before provider I/O.

`resolveChildAgentOptions()` copies the parent's same-route effort after the inherited provider/model/maxTokens and before request overrides. The source is the parent's last logged request when that request used the child's provider/model pair; otherwise `parent.options.reasoningEffort` on the same pair. A child that changes provider or model does not inherit the previous model's opaque effort id. `dsh-tool-subagent` accepts an optional configured `reasoningEffort` string and brands it before forwarding.

Cold resume still omits per-activation knobs from `subagent/descriptor`. A resumed child reconstructs only the durable route and then takes that route's current adapter or provider default.

## Alternatives considered

**Copy the parent's last logged effort even after a child model change.** Rejected because effort ids are adapter-owned and model-specific. Carrying `xhigh` onto a model that does not advertise it fails `UNSUPPORTED_REASONING_EFFORT` before the child can run.

**Have Web `api-proxy` install `installModelSelection` on every in-process child.** Rejected because spawn and fork children are created by the subagent driver, not `composeAgent()`. A Host-only hook would miss headless, ACP, and SDK parents that already declare effort on `AgentOptions`.

**Change pi-ai so an omitted effort stays omitted on `openai-responses`.** Rejected as the wrong owner: the parent already selected an explicit effort, and a child on the same route must send that same request. Omitting the field would still drop the parent's `xhigh` even if the gateway accepted the request.

**Persist effort on `subagent/descriptor` and restore it on cold resume.** Rejected because the descriptor already treats `maxTokens` as a per-activation budget, not durable composition. Restoring a stale effort after the parent or deployment default changed would pin a resumed child to a value its current route may no longer support.

## Testing

`packages/subagent/subagent-in-process-driver/tests/subagent-in-process-driver.spec.ts` asserts that a child inherits `xhigh`, that an explicit child effort overrides it, and that a child model change drops the previous model's effort. `packages/core/agent-loop/tests/loop.spec.ts` asserts that `AgentOptions.reasoningEffort` seeds the first request and that an empty id is rejected before publication.

The failing Web child sessions (`dae08b37-b812-44a5-9929-8d796874f3ea` and siblings) logged `mqj-gpt` / `gpt-5.6-sol` with no `reasoningEffort`; the parent session `session-5547be63-7814-4a86-831e-1b968669d463` logged `reasoningEffort: "xhigh"` on the same route and completed. No new keyless snapshot is added: the shipped examples do not compose this gateway profile, and the defect is the missing inherited field on the child's first `request/header`, which the focused tests now pin.

## Consequences

In-process children on the same route now send the parent's selected effort, so a Web parent on `gpt-5.6-sol` / `xhigh` no longer produces a child request that serializes `effort: "none"`. Changing the child route still leaves effort unset so the new model's adapter default applies. Callers that already override `agentOptions.reasoningEffort` keep that override. Out-of-process providers still own their separate runtime configuration.
