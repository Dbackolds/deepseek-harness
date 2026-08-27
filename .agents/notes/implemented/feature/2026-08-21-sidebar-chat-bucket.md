# Agent Note: Sidebar Chat Bucket

Status: implemented

English | [中文](2026-08-21-sidebar-chat-bucket.zh.md)

## Problem

The grouped sidebar only listed Host project Workspaces. Chats that are not bound to a project either sat under the Host **No Repo** workspace as if it were another project folder, or appeared in a trailing Ungrouped bucket that existed only when such Sessions were already visible. Starting a conversation therefore required opening or targeting a Workspace, and the empty region under the last project folder had no durable Chat entry.

## Decision

The grouped list always ends with a **Chat** bucket (`UNGROUPED_KEY`). Product copy is **聊天** / **Chat**. The Host No Repo workspace is omitted from the project list, the picker, and Workspace drag, and its Sessions occupy Chat together with any Session outside every project Workspace.

Chat's ＋ expands the bucket and calls `startSession` with the No Repo id when that workspace is registered, otherwise with no id so the shared New Session action still lands on visible No Repo. Chat has no Workspace menu, hover card, or Workspace drag. Hide does not fold Chat into Hidden: a hidden No Repo stays the Chat backing account so chats remain reachable without a project folder. Search labels for No Repo Sessions use the Chat dictionary label.

When No Repo is registered, Manual-mode Session drags inside Chat write that Host account; without No Repo, Chat order stays browser-local like the former Ungrouped bucket.

## Alternatives considered

**Keep No Repo as an ordinary Workspace row and only rename it.** Rejected: it would still sit among project folders, expose Hide/Delete/Add folder, and remain draggable as a Workspace.

**A second top-level section above Workspaces.** Rejected: Chat is the no-project remainder, not a peer grouping mode; trailing placement matches the previous Ungrouped position and keeps project folders contiguous.

**Leave Chat absent until the first no-project Session exists.** Rejected: the empty region then has no ＋, so a user still cannot start a chat without a Workspace.

## Consequences

- Grouped mode always renders Chat after visible project Workspaces and before Hidden, including when Auto-hide omits empty project Workspaces ([Auto-hide empty workspaces](2026-08-26-auto-hide-empty-workspaces.md)).
- No Repo never appears as a project row, picker item, or Hidden-section row.
- Chat ＋ starts a no-project session; blank rows still stay off the list until the first accepted prompt.
- Delete of a project Workspace still spills remaining Sessions into Chat.

## Testing

Tree tests pin always-on Chat, No Repo fold-in, hidden No Repo remaining in Chat, and Hidden omitting No Repo. Browser tests pin Chat ＋ targeting No Repo or an unscoped start, no Chat Workspace menu, and grouped mode showing Chat instead of the empty copy. Locale keys `group.ungrouped` and `delete.desc` carry the Chat product copy.
