# Agent Note: Sidebar session activity sections

Status: implemented

English | [中文](2026-08-15-sidebar-session-activity-sections.zh.md)

## Problem

The sidebar already marks finished-unviewed, running, and idle Sessions with dots, but the list itself stays one recency or Workspace pile. Finished work that still needs a look sits next to live work and old History, so the operator has to scan every row to find what just completed or what is still running.

## Decision

`ui-workspace` splits every visible Session list — Workspace groups and the flat list — into three status sections in this order: **Completed** (`completed` reminder, no live work), **Running** (pending interaction or own or descendant activity), and **History** (every remaining idle Session). Classification is a pure function of the existing row bits; opening a Session still clears the reminder through `SessionManager`, so that row moves from Completed to History without a second read store.

Completed and Running stay fully expanded. History keeps the existing five-row fold and transient **Show more** control from [Workspace Sidebar Order and Folding](2026-08-11-workspace-sidebar-order-and-folding.md). Session drag stays inside the section it started in; the persisted account order still holds every Session, and a drop only rewrites neighbors that share that section.

## Alternatives considered

**Replace Workspace grouping with these three sections.** The request is a status split of the existing list, not the removal of Workspace membership, add/rename, or Host Session order.

**Add a third view-options mode.** A mode the operator must enable would hide the split on the default Workspace view, which is the list in the screenshot.

**Persist a separate read set.** The green reminder already means finished and unviewed in this browser. A second durable read bit would drift from `SessionManager.completed`.

## Consequences

The three headings are presentation-only. Search stays one flat match list. Workspace headers, Host order, and the reminder lifetime stay as they are. A Session that starts running leaves Completed immediately; a Session that is opened leaves Completed on the next list snapshot. A crash/reload-interrupted Session is listed as interrupted; `session.list` then resumes it and wakes one plugin-notice continuation turn.

## Testing

Tree tests cover the three-way classification and empty-section placeholders. Browser tests cover the flat-list headings, History fold after five idle rows, and the existing Workspace History fold copy.
