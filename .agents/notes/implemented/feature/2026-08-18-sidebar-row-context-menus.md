# Agent Note: Sidebar row context menus

Status: implemented

English | [中文](2026-08-18-sidebar-row-context-menus.zh.md)

## Problem

Workspace and Session rows in the sidebar history list already expose Rename, Fork, Archive, Add folder, and Delete through a hover-only trailing ellipsis. Opening those verbs requires finding a 16px control that stays hidden until hover. A right-click on the row itself is the expected list-row gesture and currently does nothing, so the browser's page menu appears over the history list instead.

The ellipsis dropdown is a leave-to-close control anchored on the trigger button. A right-click must open at the pointer and stay until selection, outside click, or Escape. Sharing one `Menu` instance for both gestures couples their open state, placement, and leave-to-close policy.

## Decision

A real Workspace row and a non-blank Session row each own two `Menu` instances. The trailing ellipsis keeps its original dropdown inside the hover-only `rowActions` cell: it measures the trigger button, closes when the pointer leaves, and is unchanged for hover users. The context menu is a second portal list rendered outside that hidden cell and placed from a zero-size rect at `clientX`/`clientY`. Opening one closes the other. Both lists offer the same verbs — Workspace Rename / Add folder / Remove folder / Delete workspace, Session Rename / Fork session / Archive session — through one shared select helper per row kind. Hover cards stay suppressed while either menu is open. The live GUI serves `lib/client.js`, not sources; `/reboot` restarts the session and does not rebuild or swap that bundle.

The ungrouped bucket and a blank New Session row still have no verbs. Their right-click only calls `preventDefault` so the browser menu does not cover the list.

## Alternatives considered

**Share one `Menu` and switch its anchor between the ellipsis and the pointer.** Rejected because the two gestures disagree on placement and leave-to-close, so one instance cannot keep both behaviors.

**Ship the context menu from an out-of-tree sidebar plugin.** Rejected because the verbs and dialogs already live in `ui-workspace`; a plugin would have to re-implement or reach across the slot contract to rename, fork, archive, and delete.

**Give the context menu a different item set from the ellipsis.** Rejected for this change: the missing gesture is an opener, not a new verb set.

**Leave the native browser menu on rows without verbs.** Rejected because a right-click on Ungrouped or a blank New Session would still cover the history list with page-level items that do not apply to that row.

## Consequences

Each eligible row has two menu instances and one item list. Pointer placement uses the existing portal `getAnchorRect` seat; `Menu` itself does not grow a context-menu mode. Search result rows still have no row menu, so a right-click there remains the browser menu.

## Testing

`rows.client.spec.tsx` opens the context menu from a right-click at a known pointer, then opens the ellipsis menu and asserts a different instance and a different placement. It dispatches Rename from the ellipsis path, keeps the existing ellipsis cases, and asserts that Ungrouped and blank New Session rows suppress the browser menu without rendering items.
