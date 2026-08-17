# Agent Note: Desktop Node resolution for Finder launches

Status: implemented

English | [中文](2026-08-15-desktop-gui-node-resolution.zh.md)

## Problem

`resolveNodeExecutable` fell back to the bare command `node`. A Finder- or `open`-launched Electron process inherits the short GUI `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`), which contains no Node, so spawning `dsh web` failed with `spawn node ENOENT` until some launch had persisted a Node path in the launch memory.

## Decision

After the pinned `DSH_NODE_EXEC` path, a packaged Host's bundled Node (`host/node` or `host/node.exe`) wins over a remembered system Node so a release upgrade does not keep using the previous checkout's binary. Checkout launches then probe `npm_node_execpath` and absolute Node locations (`/usr/local/bin/node`, `/opt/homebrew/bin/node`, `~/.volta/bin/node`, `~/.asdf/shims/node`) before falling back to `node` on `PATH`. The chosen absolute path is used for the spawn and reaches the launch memory through the existing `host.child.spawnfile` persistence.

## Alternatives considered

**Keep remembered system Node ahead of the packaged binary.** Rejected because an upgrade would keep spawning the previous checkout or Homebrew Node after the installer has shipped its own.

**Embed Node inside the Electron asar.** Rejected because Electron's `process.execPath` cannot run the CLI, and the Host is staged beside the app as extraResources.

## Consequences

Packaged launches use the bundled Node and do not consult the GUI `PATH`. Checkout terminal launches still prefer `npm_node_execpath`. A first-ever Finder launch of a checkout on a machine with Node in a common Homebrew/Volta/asdf location now boots the Host; exotic locations still need one successful terminal launch or `DSH_NODE_EXEC` to seed the memory.

## Testing

`apps/desktop/tests/host.spec.ts` keeps covering `resolveNodeExecutable`; the candidate list depends on the host filesystem, so the probe is exercised by the rebuilt `open` launch (`/usr/local/bin/node` picked on this machine).
