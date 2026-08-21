# Agent Note: Marketplace Host row owns the RPC channel

Status: implemented

English | [中文](2026-08-19-marketplace-host-row-owns-rpc.zh.md)

## Problem

The web bundle mounts two Loader rows for the in-box marketplace: Host `plugin-marketplace` and browser `ui-settings-plugin-marketplace`. Both named `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace`, whose package entry re-exported the Host `apply`. The second row therefore registered `/plugin-marketplace` again. `dsh web` printed its readiness URL, then the plugin tree failed with `webserver: duplicate prefix route "/plugin-marketplace"`. Desktop treated that as a crash loop and stopped remounting.

## Decision

`plugin-marketplace` imports `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host`. The package entry is an empty Host `apply` for the browser row, matching other dual-face settings plugins. `/plugin-marketplace` and the slash commands stay on the Host row.

## Alternatives considered

**Keep one Loader row.** Rejected: `dsh.client` discovery still needs a host-visible browser row so the modules node half can serve `./client`.

**Make the Host `apply` idempotent on a second register.** Rejected: duplicate `(kind, path)` is a composition error on the webserver. Two rows that both own the RPC channel would still hide a second Host half.

## Consequences

A checkout that already built `lib/index.js` still fails until this split is present. The Host row specifier is a published export; overlays that copied the old package-entry name for `plugin-marketplace` keep colliding. The web-app roster keeps both rows: `plugin-marketplace` names `./host`, and `ui-settings-plugin-marketplace` names the package entry. The browser row is not a second RPC owner. Dropping it leaves Settings → Plugins on the generic configuration cards, because `pluginMarketplaceUi` never mounts.

## Testing

- `packages/client/ui-settings-plugin-marketplace/tests/host/entry-split.client.spec.ts` requires the Host row to name `./host` and the package entry to stay empty.
- `packages/client/ui-settings-plugin-marketplace/tests/invariant.client.spec.ts` keeps Host identity on `./host`.
