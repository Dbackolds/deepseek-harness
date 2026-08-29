# Agent Note: Desktop Host workspace-closure backfill

Status: implemented

English | [中文](2026-08-29-desktop-host-closure-backfill.zh.md)

## Problem

`pnpm --filter @deepseek-ai/dsh deploy --legacy --prod` prunes the packaged Host to the CLI's npm dependency graph, but the running Host resolves more than that: Service Definitions and providers that appear only as `peerDependencies` of deployed packages, plugin rows inside bundle `cordis.patch.yml` files (for example `dsh-base` composes `dsh-llm-default-policy` without depending on it), and `dsh.client.inject` lists. The `desktop-v0.1.2-alpha.1.1` archives therefore booted into wholesale plugin-import failures — 32 workspace packages missing at boot or at lazy composition time (`dsh-jobs`, `dsh-credentials`, `dsh-workflow`, `dsh-llm-default-policy`, …), the last of them surfacing only when a session mounted the PTC preset.

## Decision

`scripts/desktop/backfill-host-closure.ts` runs in `stageHost` right after `restoreVendoredHostPackages`. It computes the reference set of the deployed tree — every deployed package's `dependencies` and `peerDependencies`, its `dsh.client.inject` list, and the plugin rows of every `cordis.patch.yml` / `agent.cordis.yml` under a deployed `@deepseek-ai` package, parsed with the shared `loadCordisYaml` so `!!js` expressions survive — and copies each missing `@deepseek-ai/*` name from the built workspace, repeating until a pass copies nothing (a copied package can itself reference another omitted one). Copies carry the deploy shape: `lib/`, `package.json`, preset and asset directories, never `src/`, `tests/`, or tsconfig/tsdown files. A referenced package without a built `lib/` fails the pack loudly.

Spec fixtures cover the name index, specifier-to-package reduction (subpaths, bare ids, absolute paths), the reference scan (peers, quoted and subpathed composition rows, `!!js` config), transitive closure, directory shape, and the copy-nothing pass over an already-complete tree.

## Consequences

A fresh `desktop-v*` archive now boots and composes every preset without manual patching; the closure cost is one bounded scan per pack and a few megabytes of copied packages. The backfill is intentionally dumb about semantics — it copies every referenced workspace package rather than deciding which references "matter", so it cannot under-fill, but a package referenced only by a composition row the deployment never activates still ships. Removing it requires deploy itself to carry the full reference closure (or the bundles to declare every composed plugin as a dependency); until then the Host archive contract implicitly includes this step.

## Alternatives considered

**Declare every composed plugin as a `dsh-base` dependency.** Rejected as the sole fix: it covers one bundle's rows but not peers-of-peers or other bundles' compositions, and each new composition row becomes a chance to forget a manifest edit.

**Ship `--config.auto-install-peers` adjustments.** Rejected empirically: the pack already passes `auto-install-peers=true`, and a local reproduction of the exact deploy invocation still omits the same 32 packages.
