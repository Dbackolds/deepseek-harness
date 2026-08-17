# Agent Note: Approved plan review continues the same turn

Status: implemented

English | [中文](2026-08-18-plan-approval-same-turn-kickoff.zh.md)

## Problem

Approving `exit_plan_mode` already left plan mode and returned a successful tool result, so the agent loop opened the next step of the same turn. That next request no longer carried `plan:policy`, and the only remaining user text was the original planning task. Models therefore treated the planning job as finished, replied, and waited for another user message instead of carrying out the approved plan.

The shipped plan-policy section and the tool description both described implementation as beginning in "a later step after approval", which matched the loop but not the product expectation that Approve means start now.

## Decision

An approved review still records the silent pending exit and keeps `plan:policy` for the rest of the current tool batch. The same success also calls `exec.deferContext()` with a `{ kind: 'plugin', plugin: 'plan-mode', form: 'notice' }` kickoff that tells the next request of this turn to carry out the approved plan now, follow any after-approval instructions already in the conversation, and not wait for another user message.

The tool result text and the shipped `plan:policy` section use the same wording: Approve leaves plan mode, and the next step of this same turn implements the plan. Keep-planning, a dismissed review, and every other failed review still attach no kickoff.

This continues the [plan-mode collaboration state](../simplification/2026-07-22-plan-specific-collaboration-state.md) reviewed-exit contract; it adds the missing implement-now context after `plan:policy` is removed.

## Verification

`dsh-plan-mode` package tests pin the approved result text, the deferred kickoff source and wording, and the absence of that context on keep-planning. The loop integration test drives a real `exit_plan_mode` review through the agent loop and asserts the second request omits `plan:policy`, contains the kickoff, and produces the scripted implementation reply without another user follow-up.

## Alternatives considered

- **Rely on the existing tool-result sentence alone** — rejected: after approval the planning-task user message still dominates the request, and the result text saying "starting with your next step" still reads as later work rather than this turn.
- **Steer a synthetic user "start implementing" message** — rejected: that would look like a new human prompt, wake a later turn if the current one had already stopped, and mix host attestation with plugin context.
- **Keep `plan:policy` until the first post-approval request finishes** — rejected: the mode flip is already the durable fact that planning ended; a leftover planning section would continue to forbid the mutations the approved plan requires.

## Consequences

Approve now starts implementation in the same turn without a second user prompt. The cost is one extra plugin-sourced context on every approved review, visible in the transcript as a `plan-mode` notice. Models can still ignore the kickoff; the change makes the obligation explicit rather than enforcing it.
