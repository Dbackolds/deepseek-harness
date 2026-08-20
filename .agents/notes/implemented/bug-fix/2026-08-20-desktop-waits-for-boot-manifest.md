# Agent Note: Desktop waits for the boot manifest before loadURL

Status: implemented

English | [中文](2026-08-20-desktop-waits-for-boot-manifest.zh.md)

## Problem

The desktop window treats the `dsh web: http://127.0.0.1:<port>` line as permission to `loadURL`. That line prints when the HTTP server can form the loopback URL. The modules row injects `window.__DSH_BOOT__` later. A load in that gap runs the shell against a page with no boot graph. `parseBootManifest` threw before `createRoot`, so `#root` stayed empty and the window painted white. Reloading the same origin after the modules row mounted showed the GUI.

## Decision

`AppWebEntry.run` mounts `AppRoot` first. A missing or malformed boot graph stays on that page and reports the parse error. `startWebHost` still waits for the readiness line, then polls `/` until the body contains `window.__DSH_BOOT__` before the window loads the origin.

## Alternatives considered

**Keep loading on the readiness line and only paint the fail-loud page.** Rejected as the only fix: a first-load miss still leaves the operator on an error page until they refresh.

**Move the readiness line after the modules row.** Rejected: supervisors and tests already treat that line as "the HTTP server is listening". Changing its meaning would stall every waiter that only needs the port.

## Consequences

The desktop loading page stays up through the modules-row gap. A Host that never injects the graph times out with `timed out waiting for window.__DSH_BOOT__` instead of a white window.

## Testing

- `packages/client/web/tests/boot-manifest.client.spec.tsx` mounts `AppWebEntry` with no `__DSH_BOOT__` and expects the fail-loud report.
- `packages/client/web/tests/app-root.client.spec.tsx` still paints a missing-manifest message on the same page.
- `apps/desktop/tests/ready.spec.ts` accepts an index that already carries the graph and rejects a bare shell.
