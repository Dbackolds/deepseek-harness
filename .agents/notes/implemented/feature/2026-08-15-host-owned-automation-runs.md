# Agent Note: Host-owned Automation runs

Status: implemented

English | [中文](2026-08-15-host-owned-automation-runs.zh.md)

## Problem

Users need a configured rule that opens a **new Session** at a wall-clock time and submits a fixed task. Session-local Schedule returns to the original live conversation, does no work while that Session is cold, and explicitly refuses a global scheduler. Goals, jobs, workflows, and headless one-shots also fail this product: they attach to an existing Agent, die with a process-local job, require a parent Agent, or exit after one run.

A second need is an internal open interface: Settings, Host RPC, and later model tools must share one mutation path. Natural language is the model's job; the harness must not parse “every weekday at nine”.

## Decision

`ctx.automation` owns a Host-level rule table in the `automation` storage domain. A live Web Host arms timers from enabled rules and fires by creating a Session with `origin: 'automation'`, pinning an optional permission preset, appending log-only `automation/start`, and queueing the task as a plugin-sourced user message.

Selectors are `after`, `at`, `every` (≥ 300s, latest-only), and `local-clock` (`HH:mm` plus optional ISO weekdays and an explicit IANA zone). There is no Cron evaluator. `onOverlap` is per-rule `skip` | `replace` and looks only at that rule's previous `started` Session: busy means a live Agent with `status === 'running'`. `skip` records `skipped_busy`; `replace` cancels with `{ kind: 'automation', ruleId }` and opens the new Session immediately.

Tools, Host RPC, and the Web sidebar panel are Consumers of the same service. This note ships the service, durable tables, origin/cancel-cause extensions, model tools, Host RPC, and package tests. The [Web Automation sidebar](2026-08-15-web-automation-sidebar.md) occupies `sidebar.automation` under New Session on that interface.

## Alternatives considered

**Extend `dsh-schedule`.** Schedule's durable authority is the original Session log and its delivery mode is `session-local`. Folding Host-wide new-session rules into that stream would mix two identities and revive the global-scheduler alternative that Schedule already rejected.

**Store rules in `settings.yaml`.** Settings namespaces hold scalar user preferences. A collection of branded ids, selectors, and run history is a storage domain.

**Parse natural language in the harness.** Time-context already tells the model the request-local zone. A second parser would duplicate that work and invent a calendar language.

**Wait for `whenIdle()` on `replace`.** The product asked to start the new Session immediately. Cancel stops the current turn and clears the inbox; downstream tools may still be winding down.

## Verification

Package tests cover selector validation, create/fire of an `after` rule, `skip` versus `replace` overlap, idle-not-busy, permission pinning, delete-without-id-reuse, `runNow` leaving the next target, the live timer owner, the domain/table invariant, and tool authority. Session tests accept `origin: 'automation'` and reject other origin literals.

## Consequences

Fired Sessions appear in the ordinary list with `origin: 'automation'`. A stopped Host does not fire. Recurring catch-up is latest-only. Model tools refuse mutate calls that are not on a live root Agent turn whose opening message is `{ kind: 'user' }`, so a fired Session cannot create more rules.
