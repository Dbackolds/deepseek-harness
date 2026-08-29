# Agent Note: Desktop authenticated readiness handshake

Status: implemented

English | [中文](2026-08-29-desktop-authenticated-readiness-handshake.zh.md)

## Problem

`fix(web): authenticate the browser Host API` (`3e24087bfa`) changed three facts the desktop window depends on. The readiness line now prints the authenticated URL (`dsh web: http://127.0.0.1:<port>/?token=…`), the boot graph is injected as `globalThis["__DSH_BOOT__"]` instead of `window.__DSH_BOOT__`, and the index answers a valid root token with a 303 that mints the `dsh-auth-*` session cookie. The desktop still matched the readiness line only when the URL ended at the port, still probed the retired single-plugin URL `/plugins/@deepseek-ai/dsh-client-modules/client.js`, and still waited for the `window.__DSH_BOOT__` marker. A packaged window therefore never resolved its readiness handshake and killed its own healthy Host when the 60-second supervisor budget expired: the `desktop-v0.1.2-alpha.1.1` archives boot their bundled Host only to have the window show the failure page.

## Decision

The desktop honors the Host contract as it exists now, and the shared contract is pinned by spec fixtures on the desktop side.

`parseReadyLine` accepts an optional path and query after the loopback origin and keeps the full URL, token included, in `ReadyUrl.href`. The window loads that URL so Chromium performs the token-to-cookie exchange; navigation fencing derives the origin from it.

The retired `/plugins` probe is gone. Since the auth change, composing the boot graph and serving the plugin bundles is one loader row, so the manifest wait is the readiness gate. `waitForBootManifest` performs the handshake once — 303 means take the `set-cookie` pair, 401 means the token was rejected and the wait fails immediately instead of burning the budget — then polls the index with that cookie until the marker appears. A readiness URL without a token polls the index directly, so checkout and packaged launches share one path. Host output is parsed before it is echoed, because a GUI-launched process can own a stalled stdout and the handshake must not wait on the echo.

Spec fixtures now cover the tokened readiness line (with and without the LAN handoff), the `globalThis` marker form, the handshake and its cookie reuse, and the immediate 401 rejection.

## Consequences

The desktop now depends on the authenticated Host contract in both directions: a readiness URL without a token keeps the old unauthenticated index poll, and a tokened URL requires the 303 handshake, so a Host that changes either shape again fails a desktop spec fixture instead of a shipped window. The removal of the plugin-route probe drops the last reader of per-package bundle URLs; if composition later separates graph injection from bundle serving, the manifest wait must grow an equivalent second gate. A rejected token now fails the launch immediately, so a mistyped `DSH_DESKTOP_WEB_ARGS`-style token override surfaces as a failure page instead of a sixty-second blank wait.

## Alternatives considered

**Probe a composed bundle URL instead of the index.** Rejected: combo bundle URLs carry per-boot revisions, so the desktop would have to scrape them from the index it cannot read yet, and the probe would only restate the manifest wait.

**Load the window as soon as the readiness line prints.** Rejected: transport readiness does not imply application readiness, the exact false positive documented in postmortem 0003.
