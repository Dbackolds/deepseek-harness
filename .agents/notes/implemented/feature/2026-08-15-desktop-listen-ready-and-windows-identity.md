# Agent Note: Desktop listen-ready load and Windows identity

Status: implemented

English | [中文](2026-08-15-desktop-listen-ready-and-windows-identity.zh.md)

## Problem

`dsh desktop` waits for the whole Host Loader tree before the window may leave its loading page, so first paint tracks every later Host row. Windows frameless chrome used injected HTML caption buttons under a drag region, so minimize, maximize, and close did not receive clicks. Pinning the running `electron.exe` process also showed the Electron mark, because that image has no DeepSeek identity.

## Decision

The desktop process starts `dsh web` as soon as it exists, overlapping Host boot with Chromium ready. The first launch uses `--port 0`; later launches reuse the last successful loopback port from Electron userData so Chromium keeps the same origin, and an occupied remembered port falls back to `--port 0` ([origin reuse](../bug-fix/2026-08-24-desktop-reuses-host-origin-for-localstorage.md)). `web-runtime` prints `dsh web: http://127.0.0.1:<port>` as soon as `ctx.webServer` can form that URL. The HTTP server is already listening; unmatched paths stay 404 until later rows register, and the browser boot kernel waits for client plugins itself. The window loads that loopback origin; it does not serve the GUI over `file://`.

Windows uses Electron `titleBarOverlay` for the system caption buttons. The injected bar only owns the drag strip and double-click maximize, and keeps 138px of right padding so the overlay is not a drag target.

The window icon is the packaged DeepSeek whale mark (`apps/desktop/assets/icon.{png,ico}`). On Windows the CLI launches `electron.exe` directly, the process sets AppUserModelID `ai.deepseek.dsh.desktop`, and the first launch writes `DeepSeek Harness.lnk` into the Start menu with that icon and ID. Pinning that shortcut, not a raw `electron.exe` process, is what the taskbar keeps.

`DSH_NODE_EXEC` and the last successful Node path in Electron userData select the Host Node binary, because Electron's `process.execPath` cannot run the CLI.

`web-server/listening` records the first bind so other rows can observe listen without waiting for Loader settlement.

## Alternatives considered

**Wait for `loader.await()` before printing the URL.** Rejected because desktop and other supervisors treat the URL line as the moment they may open the origin. The browser boot kernel already waits for client plugins; holding the line until every Host row mounts only delays first paint.

**Keep custom HTML caption buttons.** Rejected because a frameless `-webkit-app-region: drag` strip swallows those clicks on Windows. `titleBarOverlay` is the platform caption.

**Set only `BrowserWindow.icon`.** Rejected because Windows taskbar identity follows the process image and AppUserModelID. A Start-menu shortcut that names the whale ICO and the same ID is what a pin keeps.

**Package a custom Electron helper with a rewritten PE icon.** Rejected for checkout launches. A rewritten PE icon is still not how Windows identity is claimed; the [desktop GitHub Release](../process/2026-08-17-desktop-github-release.md) ships electron-builder installers instead.

## Consequences

First paint no longer waits for the rest of the Host tree. Operators who pin the Start-menu shortcut see the whale mark; pinning the raw Electron process still shows Electron's icon. Custom HTML caption buttons are gone on Windows. Supervisors that treated the URL line as "the `/api` owner is mounted" now race later Host rows; the SPA and client boot kernel remain the readiness floor for interactive use.

## Testing

Desktop unit tests pin the whale assets, shortcut target/icon/AppUserModelID, remembered Node path, and title-bar markup without HTML caption buttons. web-app tests pin immediate URL printing without `loader.await()`. webserver tests pin `web-server/listening` against the real listen port.
