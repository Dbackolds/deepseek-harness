# Agent Note: Auto-hide empty workspaces

Status: implemented

English | [中文](2026-08-26-auto-hide-empty-workspaces.zh.md)

## Problem

Archiving the last visible Session of a project Workspace leaves an empty group row in the sidebar. [Hide Workspace](2026-08-20-workspace-hide.md) is the durable cleanup, but it moves the registration into Hidden and needs Show to reverse. Users who only want a shorter grouped list after archive would clutter Hidden or lose the Workspace until they remember Show.

## Decision

View options add a fourth group **Empty workspaces** with exclusive rows **Auto-hide** and **Always show**. Default is Always show. The preference lives on the existing persist key `dsh.workspace.view.v8` as `emptyWorkspaces: 'show' | 'hide'`; a missing field is Always show because rehydrate replaces the whole JSON value.

Auto-hide omits a project Workspace from the main grouped list when `sessionCount === 0` after the existing visibility filter (archived, blank, and subagent rows are not visible). It never calls `workspace.hide`, never writes `hiddenWorkspaceIds`, and never places those rows in Hidden. Chat / No Repo always remains. The Workspace that owns `list.current` remains, including a blank New Session. A later visible Session restores the row at Host `workspaceIds` order because the registration was never removed.

This is a browser-local presentation filter. Hide Workspace remains the Host-durable set that folds a Workspace into Hidden.

`deriveGroups` accepts optional `emptyWorkspaces` (default Always show). `SessionTree` passes the store value and derives Workspace drag neighbors from the same filtered `groups` list so omitted rows are not drop targets. Flat list, picker, search, Host hide/show, and pins are unchanged.

## Alternatives considered

**Host-hide on last archive.** Rejected: every emptied Workspace would land in Hidden, cluttering that section, and reversing it would require Show workspace rather than a view option.

**Default Auto-hide on.** Rejected: existing empty project rows would disappear on upgrade, which is a surprising loss of the grouped list the user already sees.

**Persist-key bump.** Rejected: a new key would drop pins and order; treating a missing `emptyWorkspaces` field as Always show keeps existing v8 blobs.

## Consequences

- Auto-hide shortens the grouped main list without Host-hiding; Always show restores empty project rows immediately.
- Chat and the current Session's Workspace stay visible even when empty.
- Hidden, picker occupancy, New Session targeting, and pin ids are unchanged.
- Other tabs share the preference only when they share the same origin localStorage.

## Testing

Tree tests pin Auto-hide omitting empty and archived-only project groups, keeping empty Chat, keeping a current blank owner, leaving Host-hidden groups in Hidden, and default/undefined behaving as Always show. Store tests pin default `'show'`, `setEmptyWorkspaces('hide')`, and a v8 blob without the field not reading as `'hide'`. Browser tests pin the fourth menu group, default Always show check, Auto-hide removing an empty project row without `hideWorkspace`, Always show restoring it, Chat remaining, and the current blank New Session's Workspace remaining.
