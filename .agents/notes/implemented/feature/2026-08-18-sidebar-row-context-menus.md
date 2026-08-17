# Agent Note: Sidebar row context menus

Status: implemented

English | [中文](2026-08-18-sidebar-row-context-menus.zh.md)

## Problem

Workspace and Session rows in the sidebar history list already expose Rename, Fork, Archive, Add folder, and Delete through a hover-only trailing ellipsis. Opening those verbs requires finding a 16px control that stays hidden until hover. A right-click on the row itself is the expected list-row gesture and currently does nothing, so the browser's page menu appears over the history list instead.

## Decision

A right-click on a real Workspace row or a non-blank Session row opens the same `Menu` instance the trailing ellipsis already owns. The list is unchanged: Workspace rows still offer Rename / Add folder / Remove folder / Delete workspace, and Session rows still offer Rename / Fork session / Archive session. The portal list is placed from a zero-size rect at `clientX`/`clientY` so the first painted frame sits at the pointer. Clicking the ellipsis still measures the trigger button, drops any previous pointer rect, and keeps leave-to-close. A pointer-placed menu stays open until a selection, outside click, or Escape, because the list is not next to the ellipsis wrapper. Hover cards stay suppressed while the menu is open.

The ungrouped bucket and a blank New Session row still have no verbs. Their right-click only calls `preventDefault` so the browser menu does not cover the list.

## Alternatives considered

**Ship the context menu from an out-of-tree sidebar plugin.** Rejected because the verbs and dialogs already live in `ui-workspace`; a plugin would have to re-implement or reach across the slot contract to rename, fork, archive, and delete.

**Give the context menu a different item set from the ellipsis.** Rejected because two menus for one row would split the same verbs and invite drift.

**Leave the native browser menu on rows without verbs.** Rejected because a right-click on Ungrouped or a blank New Session would still cover the history list with page-level items that do not apply to that row.

## Consequences

The row menu has two openers and one item list. Pointer placement uses the existing portal `getAnchorRect` seat; `Menu` itself does not grow a context-menu mode. Search result rows still have no row menu, so a right-click there remains the browser menu.

## Testing

`rows.client.spec.tsx` opens both row menus from a right-click at a known pointer, dispatches Rename without toggling the Workspace or opening the Session, keeps the ellipsis path, and asserts that Ungrouped and blank New Session rows suppress the browser menu without rendering items.
