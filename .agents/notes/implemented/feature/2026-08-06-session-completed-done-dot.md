# Agent Note: Session completion dot in the sidebar

Status: implemented

English | [中文](2026-08-06-session-completed-done-dot.zh.md)

## Problem

A session the operator delegated work to and then left (switched to another conversation) gives no signal when it finishes. Its running indicator stops, but the row then looks identical to any idle session, so the operator must poll the list or discover the finished work late. The pending-interaction amber dot covers sessions that need input, not sessions whose work is simply done.

## Decision

`SessionManager` owns a client-side completion-reminder set, a sibling of the pending-interaction bit: a running→idle edge arms the reminder even for the selected Session; `select()` / `selectSubagent()` / `clearSelection()` consume it only after focus leaves that Session; starting a new run disarms it and its completion re-arms it; removal prunes it immediately. The bit rides `SessionListEntry` → `SessionSummary` (optional, absent = no reminder) into the workspace browser, whose session and search rows render the existing `StateDot` `done` state — running keeps the ongoing spinner, an idle session without a reminder shows nothing — and whose hover card labels the reminder 已完成 / Completed.

The reminder is persisted in `localStorage` key `dsh.sessions.completed`. It survives reload and connection generations. Missing ids are pruned only after the first successful `session.list`, so a cold start does not wipe storage against an empty pending snapshot.

## Consequences

The sidebar row states become three disjoint signals: green = finished and unviewed, amber = awaiting the operator's input, blue = running. No wire, on-disk, or configuration format changes: `SessionSummary.completed` is optional, so existing consumers and test fixtures stay valid, and only the workspace browser reads it. The completion edge is detected eagerly at every list mutation and pull (a snapshot-build-time-only pass would collapse two consecutive status frames into one observation and miss the completion).

## Alternatives considered

- **Component-local UI state.** Rejected because the sidebar unmounts on collapse and multiple surfaces (grouped tree, flat list, search) need the same bit; the manager already owns the running transitions and the selection, so a manager-owned set is the one source all surfaces can project.
- **Event-driven arming from status frames only.** Rejected because a list pull can also carry a running→idle transition (a session finished while the refresh was in flight); the reminder is reconciled against every mutation and pull.
- **Keep the reminder memory-only.** Rejected after close/reopen dumped every finished Session into History. The reminder means "focus has not left this finished Session yet"; reload must restore that set.
