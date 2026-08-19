# Agent Note: macOS-native desktop window chrome

Status: implemented

English | [中文](2026-08-15-desktop-macos-chrome.zh.md)

## Problem

The Electron shell drew a Windows-style title bar on every platform and had no application menu. On macOS this meant no native traffic lights, no Cmd-Q/Cmd-W/Cmd-M handling, no standard Edit roles, and closing the window killed the dock process.

## Decision

`apps/desktop/src/titlebar.ts` gained a `TitlebarVariant` (`'mac' | 'windows'`) selected by `titlebarVariantForPlatform(process.platform)` in the main process. The mac variant insets the drag region on the left for the native traffic lights; the windows variant keeps the right inset for the system caption-button overlay. Neither draws its own buttons. `apps/desktop/src/main.ts` branches per platform: on darwin the window uses `titleBarStyle: 'hiddenInset'` with `trafficLightPosition` centered in the 36px bar plus `vibrancy: 'under-window'`; a standard `Menu.setApplicationMenu` built entirely from `role` items (app/Edit/Window) supplies the Cmd shortcuts; `window-all-closed` no longer quits. Host startup moved into `startHost()`/`presentWindow()` so the `activate` event reopens the window and restarts the Host from the dock while preserving the start-Host-before-Chromium overlap of the first launch. `before-quit` still stops the Host on real quits.

## Alternatives considered

**Reuse the Windows caption overlay on macOS.** Rejected: the Window Controls Overlay is not macOS chrome; `hiddenInset` gives the real traffic lights, including fullscreen behavior and correct hit testing.

**Quit on macOS when the window closes.** Rejected because the dock-icon-opens-window lifecycle is the platform convention; the Host stops on close and restarts with the reopened window.

**Draw mac-style circles in the custom title bar.** Rejected for the same reason as the overlay: the native controls are already correct.

## Consequences

Windows behavior is unchanged: the caption overlay, whale icon, and Start-menu shortcut work exactly as before. On macOS the traffic lights are native, the title reserves space for them, and menu-driven shortcuts work in the Web GUI. `window.dshDesktop` IPC stays installed on both variants for the drag-region double-click.

## Testing

`apps/desktop/tests/titlebar.spec.ts` asserts both variants: their drag insets, no self-drawn buttons, and the `titlebarVariantForPlatform` mapping. `apps/desktop/tests/host.spec.ts` walked from the Windows path `C:\Windows`, which on POSIX resolves relative to the repo cwd and falsely finds the root; it now walks from a `tmpdir()` subdirectory. Its shortcut test also asserted the `.ico` icon, but `desktopIconPath` returned the PNG on non-win32 development hosts even though `windowsShortcutSpec` only ever runs on Windows; `desktopIconPath` now takes an explicit platform and the shortcut pins `'win32'`.
