# @deepseek-ai/dsh-automation

English | [中文](README.zh.md)

`dsh-automation` owns Host-level rules that open a fresh persisted Session and submit a fixed task when a timer fires. `ctx.automation` is the only mutation path. Version 1 accepts a positive `afterSeconds` delay, an explicit `at` instant, a fixed-rate `everySeconds` interval of at least five minutes, or a `local-clock` wall time with optional weekdays.

## Config

```yaml
- id: automation
  name: '@deepseek-ai/dsh-automation'
  config:
    maxConcurrentRuns: 2
    minEverySeconds: 300
```

`maxConcurrentRuns` and `minEverySeconds` are process-level bounds, not per-rule settings. Missing `storageDomain`, `agents`, `sessions`, `workspaceRegistry`, or `agentDefaultModel` leaves the plugin pending.

## Service contract

`list()` / `get(id)` return detached views with `state: scheduled | overdue | disabled` and `nextAt`. `create(spec)` / `update(id, patch)` / `delete(id)` / `setEnabled(id, enabled)` mutate the rule table. `runNow(id)` fires without moving the next target. `listRuns(id, limit?)` returns newest-first history.

Create requires a non-empty `task`, an existing `workspaceId`, and exactly one selector. `onOverlap` defaults to `skip`. Omitted `agentPreset` / `permissionPreset` inherit the deployment defaults at fire time. A named `permissionPreset` is pinned with `permissionPresets.set` after the Session is published and before the prompt is queued.

A fire creates a Session with `origin: 'automation'`, appends log-only `automation/start`, then `followup()`s the task as a plugin-sourced user message. Dispatch means the prompt was queued, not that the model finished. One-shot rules disable after a successful fire. Recurring rules advance to the next creation-anchor or local-clock occurrence and never replay a missed backlog.

`onOverlap: skip` writes `skipped_busy` when the previous `started` Session still has a live `running` Agent and does not queue another Session. One-shot skip leaves the target in place and watches that Agent for `idle`. Recurring skip still advances so the same instant cannot loop. `onOverlap: replace` cancels the busy Agent with `{ kind: 'automation', ruleId }` and `{ keepInbox: false }`, marks the old run `replaced`, and opens the new Session immediately.

## Model Experience

### Fired session prompt

#### What the model sees

The new Session receives the rule's `task` as an ordinary user-role message. `automation/start` is log-only and does not enter derived history.

#### Token effect

One data-dependent user message per fire. Management schemas are not installed on the fired Session.

#### KV Cache effect

The prompt is the first user message of a fresh Session, so there is no reusable prior prefix.

## Known Limitations and Deferred Work

- **Host-process delivery only** — a rule fires on time only while this Web Host is live; a stopped desktop window does no OS-level wake.
- **No Cron language** — calendar expressions stay out of the protocol; `local-clock` covers daily and weekday wall times.
- **No self-reproducing fire path** — this package does not register model tools; `dsh-tool-automation` refuses mutate calls from Automation-sourced turns.
