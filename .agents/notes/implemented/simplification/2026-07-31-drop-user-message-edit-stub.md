# Agent Note: Drop the user-message edit stub

Status: implemented

English | [中文](2026-07-31-drop-user-message-edit-stub.zh.md)

## Problem

The user bubble's IconActions row carried an edit button beside copy and branch. Nothing backed it: the control had no click handler, no client mutation, and no host operation for resending an edited message. A user who found it saw an affordance the product cannot honor.

## Decision

The unbound edit control was removed because it had no host mutation. Same-session rewrite later restored a backed edit control on settled user prompts ([Same-session user prompt rewrite](../feature/2026-08-20-same-session-user-prompt-rewrite.md)). The common locale's generic `edit` term remains shared vocabulary.

## Alternatives considered

**Disable the button with a tooltip.** A visible-but-dead control still advertises editing and costs the same explaining; removal is the honest state.

**Wire it to the queue editor.** The queue edits a message that has not been sent. A settled user message is already in the transcript and in the model's context, so reusing that editor would silently mean something else.

## Consequences

An unbound edit control must not return. Settled-prompt correction is owned by `session.rewrite` and the in-place editor on user bubbles.
