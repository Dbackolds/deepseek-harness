# Agent Note: Desktop Host must not open the system browser

Status: implemented

English | [中文](2026-09-04-desktop-web-host-no-open.zh.md)

## Problem

Since `d66841ea3f` ("open the ready Web UI by default", 2026-08-14) a bare `dsh web` opens its readiness URL in the system default browser after startup (`packages/bundle/web-app`: `openBrowser` defaults to `true`, disabled only under SSH). That default is right for the CLI surface, but `apps/desktop` spawns the same `dsh web` Host and never passed `--no-open`, so every desktop launch opened the loopback UI twice: once in the Electron window and once as an extra tab in the user's default browser, on every start, on every version since 2026-08-14.

## Decision

`webHostArgs` (`apps/desktop/src/host.ts`) now appends `--no-open` to every invocation it builds, collapsing the duplicate when the forwarded args already carry one. The desktop window is the Web UI's only surface; there is no configuration in which handing the readiness URL to the system browser is correct, so the flag is unconditional rather than a `DSH_DESKTOP_WEB_ARGS` opt-out.

## Alternatives considered

- **A desktop-specific `DSH_DESKTOP_WEB_ARGS` default.** Keeps the change out of the code path but leaves the broken behavior for every user who does not know the variable exists; the misbehavior has no valid desktop use case to preserve.
- **Disable `openBrowser` inside `web-app` when launched from Electron.** Would need a new desktop-detection contract across the bundle boundary; the desktop shell already owns its Host argv and is the natural place to say what its window does and does not need.

## Consequences

Desktop launches open no browser tab anymore. The `dsh web: opening the default browser; pass --no-open to disable` line disappears from desktop launch logs. A user who wants the tab back cannot get it from the desktop shell; they run `dsh web` directly, which keeps its own default.

## Testing

`apps/desktop/tests/host.spec.ts` pins `--no-open` present in every `webHostArgs` product (including the explicit-`--port` path and the already-carried case) alongside the existing port-reuse assertions.
