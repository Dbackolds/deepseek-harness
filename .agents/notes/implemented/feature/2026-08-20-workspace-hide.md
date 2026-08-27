# Agent Note: Hide Workspace

Status: implemented

English | [中文](2026-08-20-workspace-hide.zh.md)

## Problem

The sidebar's only Workspace cleanup is registration deletion. That action drops the durable `sessionIds` account, so the group's Sessions immediately appear under Chat, including the current Session. Users who want a shorter list therefore scatter conversations they still own. Session archive already hides rows without detaching accounts; Workspace has no matching display set.

## Decision

`workspace.delete` remains registration deletion. `WorkspaceDomainState.hiddenWorkspaceIds` is a Host-durable hidden-Workspace set layered over registry order, matching the archive-set pattern: hide and show never rewrite `workspaceIds` or `sessionIds`. The Web grouped list moves hidden project Workspaces into a trailing Hidden section; Chat, the flat list, and Pinned omit those Sessions. Hide does not fold Chat / No Repo into Hidden ([Sidebar Chat Bucket](2026-08-21-sidebar-chat-bucket.md)). Show, or same-path `workspace.create`, restores the group at its prior durable index.

Product contract: Hide workspace is the primary sidebar cleanup; Delete remains registration deletion that spills Sessions to Chat.

### Durable set

`hiddenWorkspaceIds` defaults so media written before the field parse as empty. Membership is a subset of `workspaceIds`. Hide appends an already-registered id; an already-hidden id succeeds without writing. Show removes the id; a registered visible id succeeds without writing; an unknown id is an idempotent no-op returning false. Delete of a hidden Workspace also drops that id from the set in the same serialized operation. Same-path `create` of a hidden record Shows it in place and returns the existing entity (`created: false`). Domain version stays `2`; the zod default round-trips existing media.

### Host wire

| RPC / frame | Behavior |
| --- | --- |
| `workspace.list` | Carries `hiddenWorkspaceIds` next to `archivedSessionIds` as the reconnect baseline |
| `workspace.hide({ workspaceId })` | Adds one registered id; unknown id is `workspace-not-found`; answers the full updated set |
| `workspace.show({ workspaceId })` | Removes one id; unknown id is `workspace-not-found`; an unhidden registered id is success without writing; answers the full set |
| `workspace.create({ path })` | Unhides an existing hidden owner of that canonical path without minting a new id or moving order |
| `host/hidden-workspaces-changed` | Full-snapshot frame after every durable set change |

Unary hide/show install the returned set without waiting for the stream echo. A set installed while `workspace.list` is in flight supersedes that baseline's set, same race rule as archive. `ensureWorkspace` / `session.create` does not unhide; only explicit `workspace.create` does.

### Client projection

`WorkspaceListState.hiddenWorkspaceIds` mirrors the Host set. Runtime `items` stay the full Host order. Hide does not clear the current Session. Composer chip resolution still uses the owning Workspace title when the current Session is accounted there, even if hidden. The picker lists only Workspaces absent from the hidden set.

Implicit New Session / cold-start targeting, after an explicit id:

1. current Session's Workspace, hidden or not
2. visible No Repo (Chat)
3. most recent visible project Workspace
4. New Session view / picker

### Sidebar

Hide is the primary Workspace-row action and commits without a Modal. Delete stays the confirmed danger action whose copy still names Chat spill. The Hidden section is last in the grouped tree, default collapsed, with browser-local expansion key `__hidden__` that `retainAccountKeys` keeps. Expanding the section lists hidden Workspaces in durable `workspaceIds` order; expanding one Workspace lists its Sessions. That row's menu is Show plus Delete; rename and folder edits stay on visible rows.

Pinned ids of Sessions in a hidden Workspace remain in the browser pin store and drop out of the Pinned section until Show.

## Alternatives considered

**Replace Delete with Hide.** Rejected: users still need registration deletion, and Ungrouped spill remains the documented consequence of that ownership boundary.

**Browser-local hide.** Rejected: Workspace order, archive, and reconnect already treat Host storage as shared truth; a per-browser hide would disagree across tabs.

**Sidebar Hidden page.** Rejected: it duplicates search, rail collapse, and current-Session location for a secondary list.

**Spill hidden Sessions to Ungrouped.** Rejected: that is the defect Hide exists to prevent.

**Clear the current Session on Hide, matching session archive.** Rejected: Hide is a list-folding action, not a request to leave the conversation.

## Consequences

- Hide keeps the Workspace row, order entry, and `sessionIds`; those Sessions are absent from Chat, the flat list, and Pinned.
- Delete still unregisters and spills remaining Sessions to Chat; directory and logs remain.
- A current Session in a hidden Workspace stays selected; the composer is not the no-workspace inert state.
- Hidden section is last and default collapsed; Show and same-path create restore the prior durable index.
- Picker omits hidden Workspaces; search can open a hidden-Workspace Session without Showing the Workspace.
- Implicit New Session uses the current Workspace even when hidden; otherwise only visible No Repo / recent visible Workspace.
- Auto-expand of the current group inside Hidden can open one Workspace's Sessions on Hide so the open conversation remains findable.
- TUI and other non-Web consumers see the extra list field and ignore it in this delivery.
- Auto-hide empty project Workspaces is a separate grouped-list filter and does not write this set ([Auto-hide empty workspaces](2026-08-26-auto-hide-empty-workspaces.md)).

## Testing

Domain tests pin hide/show durability, unknown-id no-ops, already-hidden / already-visible no-writes, delete dropping the hidden id, same-path create unhiding in place, pre-field media defaulting empty, and restart restore. Apiproxy tests pin the list baseline, hide/show RPC, `workspace-not-found`, `host/hidden-workspaces-changed`, create unhide, and delete-while-hidden. Connection fixture tests pin hide/show frames and same-path unhide. Runtime tests pin unary echo, frame, list-baseline race, hide not clearing the current Session, and the targeting matrix. UI tests pin Hidden-section derivation, Host items order, Hide without a Modal, Hidden-row Show+Delete, picker omission, and flat/pin omission.
