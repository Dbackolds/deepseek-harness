# Agent Note: Sidebar row context menus

Status: implemented

English | [中文](2026-08-18-sidebar-row-context-menus.zh.md)

## Problem

Workspace and Session rows in the sidebar history list already expose Rename, Fork, Archive, Add folder, and Delete through a hover-only trailing ellipsis. Opening those verbs requires finding a 16px control that stays hidden until hover. A right-click on the row itself is the expected list-row gesture and currently does nothing, so the browser's page menu appears over the history list instead.

The ellipsis dropdown is a leave-to-close control anchored on the trigger button. A right-click must open at the pointer and stay until selection, outside click, or Escape. Sharing one `Menu` instance for both gestures couples their open state, placement, and leave-to-close policy.

## Decision

A real Workspace row and a non-blank Session row each own two `Menu` instances. The trailing ellipsis keeps its original icon dropdown inside the hover-only `rowActions` cell. The Session context menu is a separate compact text-only list at the pointer: Pin task, Rename task, Archive task, Mark as unread, a disabled Open in split view row, then Reveal in Finder and the copy-path rows. Pin writes the current list account to the front. Mark as unread restores the Completed reminder through `sessions.markUnread`. Reveal and the cwd copy rows use the session's projected directory. Split view and Copy log path stay disabled because this client has no split session surface and no session-log path. Opening one menu closes the other. Hover cards stay suppressed while either menu is open. The live GUI serves `lib/client.js`, not sources; `/reboot` restarts the session and does not rebuild or swap that bundle.

The ungrouped bucket and a blank New Session row still have no verbs. Their right-click only calls `preventDefault` so the browser menu does not cover the list.

## Alternatives considered

**Share one `Menu` and switch its anchor between the ellipsis and the pointer.** Rejected because the two gestures disagree on placement and leave-to-close, so one instance cannot keep both behaviors.

**Ship the context menu from an out-of-tree sidebar plugin.** Rejected because the verbs and dialogs already live in `ui-workspace`; a plugin would have to re-implement or reach across the slot contract to rename, fork, archive, and delete.

**Keep the context menu on the same three ellipsis verbs.** Rejected after the product list arrived: the right-click list is a text-only task menu, while the ellipsis stays the existing icon dropdown.

**Leave the native browser menu on rows without verbs.** Rejected because a right-click on Ungrouped or a blank New Session would still cover the history list with page-level items that do not apply to that row.

## Consequences

Each eligible Session row has two menu instances and two item lists. Pointer placement uses the existing portal `getAnchorRect` seat; `Menu` itself does not grow a context-menu mode. Search result rows still have no row menu, so a right-click there remains the browser menu.

## Testing

`rows.client.spec.tsx` opens the Session context menu from a right-click, asserts the text-only task rows including the disabled split and log-path items, pins and reveals from that menu, then opens the ellipsis menu and dispatches Rename from the original icon list. Manager tests restore a Completed reminder through `markUnread`. Ungrouped and blank New Session rows still suppress the browser menu without rendering items.
