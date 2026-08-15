# Agent Note: Desktop Node resolution for Finder launches

Status: implemented

English | [中文](2026-08-15-desktop-gui-node-resolution.zh.md)

## Problem

`resolveNodeExecutable` fell back to the bare command `node`. A Finder- or `open`-launched Electron process inherits the short GUI `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`), which contains no Node, so spawning `dsh web` failed with `spawn node ENOENT` until some launch had persisted a Node path in the launch memory.

## Decision

After the pinned, remembered, and `npm_node_execpath` candidates, `resolveNodeExecutable` probes absolute Node locations (`/usr/local/bin/node`, `/opt/homebrew/bin/node`, `~/.volta/bin/node`, `~/.asdf/shims/node`) before falling back to `node` on `PATH`. The probed absolute path is used for the spawn and reaches the launch memory through the existing `host.child.spawnfile` persistence.

## Consequences

Terminal launches behave exactly as before (`npm_node_execpath` wins). A first-ever Finder launch on a machine with Node in a common Homebrew/Volta/asdf location now boots the Host; exotic locations still need one successful terminal launch or `DSH_NODE_EXEC` to seed the memory.

## Testing

`apps/desktop/tests/host.spec.ts` keeps covering `resolveNodeExecutable`; the candidate list depends on the host filesystem, so the probe is exercised by the rebuilt `open` launch (`/usr/local/bin/node` picked on this machine).
