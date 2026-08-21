# Agent Note: macOS dock Completed badge and bounce

Status: implemented

English | [中文](2026-08-20-sidebar-completed-badge-and-dock-bounce.zh.md)

## Problem

The sidebar already keeps a browser-local Completed reminder on finished Sessions. A background macOS window does not show how many of those reminders are still unread, and a newly finished Session does not move the dock icon, so finished work is easy to miss.

## Decision

`ui-sidebar` reads the existing `completed` bit on `useSessions` list rows and calls `window.dshDesktop.setCompletedUnread(count)` whenever that count changes. The count is how many listed Sessions still carry the reminder. A browser tab has no preload and the call is a no-op. The in-page wordmark stays unmarked.

`apps/desktop` maps that IPC to a green numeric plate composited onto the packaged whale PNG, then `app.dock.setIcon`. Count 0 restores the unmarked whale. 100 or more renders as `99+`. A rising count also calls `app.dock.bounce('informational')`. Electron returns `-1` while the app is focused, so a focused window does not bounce. Other platforms ignore the IPC.

The reminder lifetime stays in `SessionManager`: a running→idle edge arms it, focus leaving the Session consumes it, and a new run disarms it.

## Alternatives considered

**Draw the count on the in-page wordmark whale.** Rejected because the requested mark is the macOS dock icon, which remains visible when the window is in the background.

**Use `app.dock.setBadge` for the count.** Rejected because that API draws the system text badge, not a green numeric plate on the whale.

**Bounce the dock on every Completed row that already exists at load.** Rejected because a reload would bounce for reminders the operator already has. Only a rising count after the previous published value asks the dock to bounce.

## Consequences

The shell now reads `useSessions` only to forward the count. Workspace grouping, row dots, and the Completed section stay in `ui-workspace`. A browser tab never badges the dock. macOS bounce is informational (about one second).

## Testing

Sidebar component tests publish the count through the preload, skip drawing an in-page numeral, and keep the shell when that call throws. Helper specs cover the count function and the preload no-op paths. Desktop specs overlay a green plate on an RGBA buffer, round-trip the packaged whale PNG, restore the unmarked icon at count 0, bounce only when the count rises, and assert the preload and main-process wiring.
