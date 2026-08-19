# Subagent and Job Delivery Settings

English | [中文](subagent-delivery-settings.zh.md)

Accepted contract for user-configurable busy-state delivery of runtime notices.

## Problem Statement

Busy-state composer Enter already persists through Host settings. Continuable settlement, child `report`, and background Job completion still pick parent inbox placement in code. A parent that is already working therefore cannot choose whether those notices enter the nearest step or wait for the next turn.

## Solution

Settings → Subagents gains a Behavior group with three independent busy-state selectors. Each writes a Host section in `$DSH_HOME/settings.yaml`. The next notice on a live parent follows the stored choice. Idle parents always open a later turn. A parent already in teardown still receives injection and is never woken.

## User Stories

1. As an operator, I want settlement, report, and Job notices to keep independent busy-state choices, so one noisy channel does not force the others.
2. As an operator, I want Steer to mean “after the current step”, so a running generation or already-dispatched tool is not aborted.
3. As an operator, I want Queue to mean “after the current turn”, so the parent can finish its own tool loop first.
4. As an operator, I want an idle parent to wake on every notice, so a parked parent still learns the outcome.
5. As an operator, I want a change to apply to the next notice on an already-running session, so I do not restart dsh to try the other placement.
6. As an operator, I want the three choices to survive reload and dsh restart through `settings.yaml`, so the page is not a one-shot override.
7. As an operator, I want the Behavior group above the definition library, so keyboard Enter stays on General Settings.
8. As a snapshot author, I want deployment `quiet` flags to remain, so deterministic transcripts do not start extra turns.

## Implementation Decisions

- Namespace: `subagent-delivery`. Fields: `settlementBusy`, `reportBusy`, `jobBusy`. Values: `steer` | `queue`. Schema default for each field is `steer`.
- Host registration lives on the Subagents settings plugin host half, the same pattern as `ui-conversation.busyEnter`. The section is live, not restart.
- Runtime readers resolve `ctx.settings.get()` at send time. A missing settings service or unregistered section is `steer`.
- Busy + `steer` calls `parent.steer()`. Busy + `queue` calls `parent.followup()`. Idle always `followup()`, including when the stored field is `queue`.
- Teardown still injects and never wakes, ignoring the user field.
- `tool-subagent-report` `reportDelivery: quiet` and `tool-jobs` `completionDelivery: quiet` remain deployment overrides. They only suppress waking. They do not rewrite a busy Steer into Queue.
- Job idle wakeup still spends `maxConsecutiveWakes`. Busy Steer does not spend that budget. Quiet delivery still never wakes.
- Report default becomes Steer while the parent is busy. Settlement default stays Steer. Job busy path changes from inject to Steer.
- UI copy reuses 插话发送 / 排队发送. The Behavior intro states the step-versus-turn meaning and that idle always opens a turn.
- Composer `ui-conversation.busyEnter` is unchanged.

## Testing Decisions

- Host registration: register, default, accept `queue`/`steer`, reject other values, dispose unregisters.
- Settlement: busy steer / busy queue / idle followup / teardown inject.
- Report: wakeup + busy steer / wakeup + busy queue / idle followup / quiet still injects.
- Jobs: busy steer / busy queue / idle followup / quiet idle inject / wake budget unchanged / teardown silent.
- Settings page: Behavior group renders three selectors; changing a field writes the Host scope; library CRUD still works.
- Persistence: yaml contains the written fields after a UI change. Reload is covered if an existing settings-chrome path can host it cheaply; otherwise Host plus client scope tests are enough.

## Out of Scope

- Composer busy-Enter persistence and defaults.
- Aborting a live generation or an already-running tool.
- Foreground subagent calls.
- AgentTeams mailbox placement and `send_message`.
- An idle Quiet user option.
- Per-session overrides.

## Further Notes

Steer is nearest-step admission, not cancellation. Several Steer notices that land in the same next-step inbox are claimed together.

**Steer** admits a user-role message at the nearest later step after the current generation or already-dispatched tools finish. It does not abort work already in flight.

**Queue** admits a user-role message as its own later turn after the current turn closes.

**Inject** places model-facing context on the next-step inbox without waking an idle driver. It is used for teardown and deployment Quiet, not as a user setting.
