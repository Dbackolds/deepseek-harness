# Agent Note: Profile pnpm resolution beyond a GUI PATH

Status: implemented

English | [中文](2026-08-16-profile-pnpm-gui-path.zh.md)

## Problem

`runProfilePnpm` spawned the bare name `pnpm`. A terminal `PATH` usually includes Homebrew, npm-global, or pnpm's official home, so `dsh plugin` and marketplace `/update` work there. A Finder or `dsh desktop` launch inherits macOS's short GUI `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`), which has neither `pnpm` nor `node`. Marketplace `/update` and in-app install then report a missing pnpm even though the same machine already has one.

## Decision

`resolveProfilePnpm` is the single locator `runProfilePnpm` uses. It searches `PATH` first, then well-known install directories (`PNPM_HOME`, pnpm's official homes, npm-global, Homebrew, Volta, asdf, and this Node's directory), then Corepack next to this Node. The child `PATH` includes those directories so a `#!/usr/bin/env node` shim can start under the inherited GUI environment. A host with no pnpm still returns the structured `missingPnpm` result.

## Alternatives considered

**Ask the user to add pnpm to the GUI `PATH`.** Rejected: Finder and Electron do not load the user's shell profile, so the same machine that already runs `dsh plugin` from a terminal would keep failing in the product UI.

**Ship a pinned pnpm with the product.** Rejected by the [repository-plugin removal](../simplification/2026-08-09-remove-repository-plugin.md): profile mutations stay an explicit host package-manager operation and do not reintroduce a bundled runtime.

**Resolve pnpm only inside the marketplace plugin.** Rejected: `dsh plugin`, marketplace `/update`, and the install RPC all share `runProfilePnpm`; a second locator would drift.

## Consequences

Desktop and Finder launches can update profile plugins when a well-known host pnpm exists. A machine with no pnpm still fails loud. Adding another official installer home updates `profilePnpmSearchDirs` rather than a caller.

## Testing

- `packages/boot/app-boot/tests/profile.spec.ts` covers PATH preference, a GUI-short PATH plus `~/.npm-global/bin/pnpm`, Corepack next to Node, a true miss, and a live spawn of a staged well-known shim.
