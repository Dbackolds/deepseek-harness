# Agent Note: Sidebar Completed badge and macOS dock bounce

Status: implemented

English | [中文](2026-08-20-sidebar-completed-badge-and-dock-bounce.zh.md)

## Problem

The sidebar already keeps a browser-local Completed reminder on finished Sessions and shows those rows in the Completed section. The brand whale in the logo row does not report how many of those reminders are still unread, so an operator who is not looking at the list has no count. On macOS, a newly finished Session also does not move the dock icon, so a background window is easy to miss.

## Decision

`ui-sidebar` reads the existing `completed` bit on `useSessions` list rows and draws a green count badge on the wordmark whale when the column is wide and on the rail fish when it is collapsed. The count is how many listed Sessions still carry the reminder; 100 or more renders as `99+`. The badge is decorative; a visually hidden `role="status"` region names the count for assistive technology.

A rising count calls `window.dshDesktop.notifyCompleted` when the desktop Host injected that preload method. `apps/desktop` maps that call to `app.dock.bounce('informational')` on darwin and ignores it on other platforms. Electron returns `-1` while the app is focused, so a focused window does not bounce. A missing preload or a throwing Host call is a no-op; the in-page badge still stands.

The reminder lifetime stays in `SessionManager`: a running→idle edge arms it, focus leaving the Session consumes it, and a new run disarms it.

## Alternatives considered

**Put the badge on the Completed section heading only.** Rejected because the request is the brand whale in the logo row, which remains visible when the list is scrolled or the column is collapsed.

**Bounce the dock on every Completed row that already exists at load.** Rejected because a reload would bounce for reminders the operator already has on screen. Only a rising count after mount asks the Host.

**Draw a Windows taskbar flash from the same IPC.** Rejected because the request is macOS dock bounce; other platforms keep the in-page badge only.

## Consequences

The shell now reads `useSessions`. Workspace grouping, row dots, and the Completed section stay in `ui-workspace`. A browser tab never sees `window.dshDesktop` and never bounces. macOS bounce is informational (about one second) and does not set a dock badge string.

## Testing

Sidebar component tests render the count on the wordmark and on the settled rail, collapse 100 to `99+`, skip the desktop preload for reminders already present at mount, call it on a rising count, and keep the badge when that call throws. The slot snapshot pins the Chinese count on the expanded whale. Helper specs cover the count and label functions and the preload no-op paths. Style tests pin the success-token fill and the rail-hover hide. Desktop specs bounce informational when a dock is present and assert the preload and main-process wiring.
