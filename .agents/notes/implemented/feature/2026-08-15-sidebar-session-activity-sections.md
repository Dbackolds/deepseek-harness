# Agent Note: Sidebar session activity sections

Status: implemented

English | [中文](2026-08-15-sidebar-session-activity-sections.zh.md)

## Problem

The sidebar already marks finished-unviewed, running, and idle Sessions with dots, but the list itself stays one recency or Workspace pile. Finished work that still needs a look sits next to live work and old History, so the operator has to scan every row to find what just completed or what is still running.

## Decision

Classification remains a pure function of the existing row bits: **Completed** (`completed` reminder, no live work), **Running** (pending interaction or own or descendant activity), **Abnormal** (crash/reload interruption, not running again), and **History** (every remaining idle Session). Leaving a finished Session consumes the reminder through `SessionManager`. **Group by status** (the default view option) renders those buckets as foldable headings. [Sidebar live work without status folders](2026-08-19-sidebar-live-idle-without-status-folders.md) owns the optional no-section layout.

## Alternatives considered

**Replace Workspace grouping with these three sections.** The request is a status split of the existing list, not the removal of Workspace membership, add/rename, or Host Session order.

**Add a third view-options mode.** A mode the operator must enable would hide the split on the default Workspace view, which is the list in the screenshot.

**Persist a separate read set.** The green reminder already means finished and unviewed in this browser. A second durable read bit would drift from `SessionManager.completed`.

## Consequences

Search stays one flat match list. Workspace headers, Host order, and the reminder lifetime stay as they are. A Session that starts running leaves Completed immediately; leaving a finished Session drops the reminder. A crash/reload-interrupted Session stays Abnormal until it is running again; `session.list` then resumes it and wakes one plugin-notice continuation turn.

## Testing

Tree tests cover the four-way classification and empty-section placeholders. Default headings, the layout switch, and idle overflow live in [Sidebar live work without status folders](2026-08-19-sidebar-live-idle-without-status-folders.md).
