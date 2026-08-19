# Agent Note: Sidebar live work without status folders

Status: implemented

English | [中文](2026-08-19-sidebar-live-idle-without-status-folders.zh.md)

## Problem

The sidebar already paints live, waiting, interrupted, and completed Sessions on each row. Wrapping those same bits in foldable Completed / Running / Abnormal / History headings made one Workspace look like three nested folders. Operators could not tell whether a heading classified rows, hid them, or truncated History, and a single live Session still sat under a Running disclosure.

## Decision

View options persist `activityLayout`. **Group by status** (`folders`, the default) restores the foldable Completed / Running / Abnormal / History headings from [Sidebar session activity sections](2026-08-15-sidebar-session-activity-sections.md). **No status groups** (`inline`) keeps Workspace and Pinned as the only foldable groups. `partitionLiveIdle` then floats pending interaction, own running, and running-descendant rows above idle rows. Completed, Abnormal, and idle History stay mixed in the idle cluster; their dots stay on the row. Live rows never enter the five-row overflow. Idle overflow still uses the transient **Show more** control from [Workspace Sidebar Order and Folding](2026-08-11-workspace-sidebar-order-and-folding.md). Session drag stays inside the live/idle cluster or status folder it started in.

## Alternatives considered

**Keep foldable status headings and only restyle them.** The heading would still act as both a category and a disclosure, which is the control collision operators reported.

**Add status filter chips or a Status grouping mode.** Those remain available later. They were not needed to remove the nested-folder reading of the default list.

**Pin Abnormal above idle rows as a second live cluster.** Interrupted Sessions already carry a red row dot. A second automatic cluster would recreate a status folder for a rare state.

## Consequences

- An open Workspace or flat list always shows every live Session.
- Idle Sessions still default to five visible rows until Show more.
- Persisted `activityExpansion` keys fold status headings only while **Group by status** is on; the Pinned heading still folds in both layouts.
- Search remains one flat match list.

## Testing

Tree tests cover live-before-idle partitioning, the four-way classification, and the persisted layout. Browser tests cover default status headings, switching to no status groups, and idle overflow after five rows.
