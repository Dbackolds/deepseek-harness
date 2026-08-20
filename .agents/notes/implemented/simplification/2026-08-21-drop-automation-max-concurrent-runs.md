# Agent Note: Drop Host-wide Automation concurrent-run admission

Status: implemented

English | [中文](2026-08-21-drop-automation-max-concurrent-runs.zh.md)

## Problem

Several daily rules can share one `local-clock` instant. The Host admitted only two live Automation Sessions, so later due rules wrote `skipped_busy` with `errorCode: max_concurrent_runs` and advanced to the next day. History showed only “Skipped” / 0s. Per-rule `onOverlap` already decides what to do when that rule's previous Session is still running; a second Host-wide cap silently dropped independent work.

## Decision

`dsh-automation` no longer has `maxConcurrentRuns`. A due or run-now fire opens a Session unless that same rule's previous `started` Session still has a live `running` Agent and `onOverlap` is `skip`. Independent rules in one due batch all start. Recurring skip still advances so one busy rule cannot loop the same instant. Historical `errorCode: max_concurrent_runs` rows remain readable but the service no longer writes that code, and the Web panel no longer localizes it.

The [Host-owned Automation runs](../feature/2026-08-15-host-owned-automation-runs.md) note still owns selectors, origin, and per-rule overlap.

## Alternatives considered

**Raise the default.** A larger number still drops the (N+1)th simultaneous rule and keeps a config knob with no product owner.

**Queue skipped rules until a slot frees.** Recurring skip already advances the next target. Queuing would invent a second delivery mode and could stampede after a long daily job.

**Keep the cap and document it in history.** The history row already collapsed both skip reasons to “Skipped”. The product request is to run every independent due rule, not to explain the refusal better.

## Verification

Package tests fire three independent `every` rules while the first two Sessions stay `running` and expect three `started` outcomes. Existing skip/replace overlap tests still cover a busy previous Session of the same rule. Client store and panel tests no longer map `max_concurrent_runs`.

## Consequences

A Host with many due rules can open that many Sessions at once. Machine load, API quota, and workspace contention become operator problems. Per-rule `onOverlap: skip` still prevents one long job from stacking copies of itself.
