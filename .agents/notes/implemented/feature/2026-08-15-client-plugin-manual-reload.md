# Agent Note: Client-plugin reload is manual by default

Status: implemented

English | [中文](2026-08-15-client-plugin-manual-reload.zh.md)

## Problem

Saving a client-plugin source file while `pnpm run dev:web` is running immediately swaps the plugin fiber. That drop of in-plugin React state, and a failed swap that does not roll back, interrupts an in-progress Web session. Host-plugin HMR is already disabled on the Web profile; the remaining crash path is the always-on client-plugin rebuilt broadcast.

## Decision

`client-hmr.autoReload` is a Host-backed boolean, default `false`. The node half still stat-polls and re-hashes bundles so a later manual reload sees current bytes. Automatic SSE `rebuilt` frames stay off until that setting is true. `POST /plugins/reload` re-hashes every watched row and broadcasts `reload` frames, which the browser half always swaps.

The same plugin owns the General settings row: a switch writes `autoReload`, and Reload plugins posts the manual endpoint. The API proxy allowlists the `client-hmr` namespace next to the other Web preferences. Remote browsers stay process-local, as with every loopback-only settings namespace.

## Alternatives considered

**Disable the `client-hmr` row until the user patches it back on.** Rejected because that also removes the poll, the SSE channel, and any later manual swap. The receiver stays mounted; only automatic broadcasts are gated.

**Keep automatic reloads and add only a reload button.** Rejected because the reported failure is an unwanted mid-edit swap, not the absence of a button.

**A slash command or model-facing tool.** Rejected because this is an operator action on the GUI, not a capability the model should trigger, and Web has no TUI `/reload`.

**Gate the stat poll itself.** Rejected because a later manual reload would then hash from a stale baseline and miss writes that landed while auto-reload was off.

## Consequences

A checkout that also runs `pnpm run dev:web` no longer replaces running client plugins on save. Developers turn Automatic hot reload on only when they want that loop, or press Reload plugins after a coherent edit. The model-visible Web update contract names both the setting and the watcher.

## Testing

Host and node-half tests pin schema registration, default-off rebuilt broadcasts, settings-driven enablement, and POST `/plugins/reload`. Client tests pin the General row, policy adoption, and apply wiring. The keyless settings scenario asserts the default-off switch, persists the YAML field across reload and a second port, and records the assembled dialog snapshot. Host persistence rides the same settings scope as [Persist Web user preferences through Host settings](../bug-fix/2026-08-06-host-backed-web-preferences.md).
