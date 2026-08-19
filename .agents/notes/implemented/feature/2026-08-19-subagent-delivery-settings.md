# Agent Note: Busy-state delivery settings for settlement, report, and jobs

Status: implemented

English | [中文](2026-08-19-subagent-delivery-settings.zh.md)

## Problem

Composer busy-Enter already persists through Host settings. Continuable settlement, child `report`, and Job completion still choose parent inbox placement in code. An operator who wants those notices after the current turn, or who wants a report at the nearest step, has no user setting. The three channels also disagree: settlement steers a busy parent, report always queues a later turn, and a Job injects the next step without a wake.

[Manager-owned settlement](2026-08-06-manager-owned-subagent-settlement-delivery.md) rejected a *deployment* switch that could omit the notice. That rejection still holds. What was missing is placement of a notice that is still always sent.

## Decision

Host namespace `subagent-delivery` carries three independent busy-state fields: `settlementBusy`, `reportBusy`, `jobBusy`. Each is `steer` or `queue`, schema default `steer`. The Subagents settings plugin registers the section. Settings → Subagents shows the Behavior group above the definition library. Runtime readers call `ctx.settings.get` at send time; a missing settings service or unregistered section is `steer`.

Placement, in order:

1. A parent already in teardown is injected and never woken.
2. An idle parent always `followup()`s.
3. A busy parent uses the matching field: `steer` → nearest step, `queue` → later turn.

Deployment `reportDelivery: quiet` and `completionDelivery: quiet` stay. They suppress idle wakeup for deterministic transcripts. They do not drop the message and they do not rewrite busy Steer into Queue.

The accepted product spec is [docs/specs/subagent-delivery-settings.md](../../../../docs/specs/subagent-delivery-settings.md).

## Alternatives considered

**Omit the notice or make settlement optional.** Rejected again. The parent-facing promise stays unconditional; only the inbox target changes.

**One shared busy switch.** Rejected. Settlement, report, and Jobs have different noise and urgency.

**Expose idle Quiet in the UI.** Rejected. A parked parent would never learn the outcome unless something else woke it.

**Keep report busy-Queue as the shipped default.** Rejected. The accepted contract aligns the three busy defaults on Steer.

**Register the schema on `dsh-subagent`.** Rejected. The settings plugin already owns the Subagents page; Job completion is not a subagent service concern. Readers tolerate an unregistered section by defaulting to Steer.

## Consequences

Busy report Steer is louder than the previous always-Queue report. Snapshot overlays that pin `reportDelivery: quiet` remain the way to keep one wake in a transcript.

Busy Job Steer is almost the same as the previous inject for a running owner. Tests that assumed inject on the default running fake agent now expect `steer`.

Composer `ui-conversation.busyEnter` is unchanged.
