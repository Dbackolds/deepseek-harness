# Agent Note: Desktop reuses the last Host origin for browser-local GUI state

Status: implemented

English | [中文](2026-08-24-desktop-reuses-host-origin-for-localstorage.zh.md)

## Problem

Pinned Sessions live in the workspace browser's persist key `dsh.workspace.view.v8`. Chromium scopes that store to the loaded origin. Desktop started `dsh web --port 0` on every launch, so each restart bound a new loopback port, Chromium treated it as a new origin, and the Pinned heading came back empty while the Sessions themselves still sat in their Workspace groups.

## Decision

Electron userData `workspace.json` stores the last successful Host port beside cwd and Node. `startWebHost` probes `127.0.0.1:<port>` before reuse. A free remembered port becomes `--port <n>`; an occupied or absent port becomes `--port 0`. An explicit `--port` in forwarded web args still wins. After the Host prints a readiness URL, that port is written back so the next launch can reuse the origin.

Pinned Session ids remain browser-local. Desktop keeps them by keeping the origin, not by moving pins onto Host settings.

## Alternatives considered

**Move pinned ids onto Host settings.** Rejected for this bug: grouping, expansion, and Session order already share the same persist key. Changing only pins would still drop the rest of the view store on a new origin, and Host settings are a different durability and schema surface.

**Give Chromium a custom `session.partition` whose localStorage ignores the HTTP origin.** Rejected: Electron still keys website storage by origin inside a persist partition. A custom partition without a stable origin does not restore the store.

**Always bind a fixed port such as 3080.** Rejected: checkout and packaged desktop can run beside `dsh web`, which already defaults to 3080. A collision would fail the window instead of falling back.

## Consequences

A normal desktop restart reopens `http://127.0.0.1:<last-port>` and restores Pinned, grouping, and expansion. If that port is taken, the window still opens on an OS-chosen port and browser-local GUI state for that origin starts empty. Forwarding `--port` continues to pin the origin to the operator's choice.

## Testing

- `apps/desktop/tests/host.spec.ts` pins remembered-port argv, rejects non-reusable ports, and checks `listenPortAvailable` against an occupied then freed loopback socket.
- `packages/client/ui-workspace/tests/tree.client.spec.ts` rehydrates `pinnedSessionIds` from `dsh.workspace.view.v8`.
- `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` renders the Pinned heading from `pinnedSessionIds` above Workspace groups.
