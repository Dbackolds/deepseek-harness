# Agent Note: Session-history tools gate is user-owned

Status: implemented

English | [中文](2026-09-07-session-history-tools-gate.zh.md)

## Problem

Session-history search and read tools (the `agent_session_*` family registered by third-party plugins, plus the core `session_search` family where composed) register globally and stay visible to every Agent, while their descriptions advertise recovering prior work. Models treat them as free long-term memory: search on uncertainty, chase hits, and block the task on full-text scans. The capability has real value only when the user explicitly wants prior-conversation recall, so availability must be user-owned.

## Decision

`packages/session-query/session-history-gate` (composed in dsh-base, so every dsh-base profile carries it) owns the `session-history-tools` user-settings namespace (`{ enabled: boolean }`, default `false`, applies live). While closed: every Agent scope hides the configured tool names through `tools.restrict({ deny })` — applied at `agent/created`, recomputed over `agents.list()` on `tools/change` and on settings flips, with disposers tracked in a `WeakMap<Agent, () => void>` and lifted explicitly on plugin unload — and a compensating prompt section (central slot `SESSION_HISTORY_GATE`, directly after `TOOL_SESSION_QUERY`) tells the model the capability is disabled by a user setting, the calls will not work, and a task that genuinely needs prior-session recall should ask the user to enable it in Settings. While open: no restrictions, no section. Without a settings provider the gate is permanently closed (fail-closed); provider detach falls back closed the same way. The `tools` config field defaults to the eight session-history tool names and is cordis-patchable; `run_code`, duplicates, and empty sets are rejected at load; unregistered names are skipped at runtime instead of throwing.

On the Web, `packages/client/ui-session-history-gate` registers one General-settings checkbox row over the same namespace through `ctx.settingsScope`: optimistic updates, revert on write failure, control disabled while the document is not writable.

## Alternatives considered

**Add the toggle inside `dsh-session-search-pro`.** Rejected: a third-party package loses the change on upgrade, and the core `session_*` tools need the same door.

**A context-global `tools.restrict()` deny.** Rejected: the registry refuses context-global restrictions — each Agent scope owns its visibility; applying per Agent at `agent/created` covers subagents and teammates.

**An execution-time guard instead of visibility removal.** Rejected: the schema stays, so the model keeps calling and collecting errors — exactly the blocking shape being removed; `restrict()` converges schema assembly and execution lookup (`UNKNOWN_TOOL`) together.

**Gate `session_control_*` by default too.** Rejected: those are user-initiated library operations, not agent-initiated recall; deployments can append their names through `tools` config.

## Consequences

- Default compositions show the model no session-history tools and no invitation to search; a one-line notice replaces them with the enabling route.
- The toggle is live: the next step assembly reflects it (schemas read the registry view per step); no session restart.
- A third-party plugin's own prompt advertising cannot be removed; the compensating section follows it and states the tools are currently unavailable.
- The gated name set is deployment config, not a code constant: a new tool name is one cordis-patch line.
