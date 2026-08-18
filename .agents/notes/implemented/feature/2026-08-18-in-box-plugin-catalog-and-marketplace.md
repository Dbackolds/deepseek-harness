# Agent Note: In-box plugin catalog and marketplace

Status: implemented

English | [中文](2026-08-18-in-box-plugin-catalog-and-marketplace.zh.md)

## Problem

Discover depended on a public GitHub raw URL in `StarPivotNet/dsh-plugin-catalog`, and the marketplace itself lived out of tree as `@starpivot/dsh-plugin-marketplace`. A fresh web profile therefore had no Discover listing until that extra bundle was installed, and even then Discover failed when GitHub was unreachable.

## Decision

The web profile ships both halves:

- [`dsh-host-plugin-catalog`](../../../packages/host/plugin-catalog/README.md) serves the pinned StarPivot `catalog.json` on the named Host route `/plugin-catalog/catalog.json`.
- [`dsh-client-ui-settings-plugin-marketplace`](../../../packages/client/ui-settings-plugin-marketplace/README.md) is the former public marketplace, now an in-box dual-face package. Its default catalog URL is that Host path. The Host half still accepts extra http(s) catalog URLs.

The shipped Plugins settings row still yields to this marketplace through [`pluginMarketplaceUi`](../architecture/2026-08-16-plugins-settings-marketplace-yield.md). The inventory tab stays disabled while the marketplace owns the page.

## Alternatives considered

- **Keep the marketplace out of tree and only vendor `catalog.json`.** Rejected because a fresh web profile would still need a second install before Discover existed.
- **Fetch GitHub by default and fall back to a bundled file.** Rejected because the Host already has a webserver; a named route is the catalog source, not a backup.
- **Mount the catalog through the SPA fallback.** Rejected because a miss would become `index.html` instead of JSON.

## Consequences

A new web profile opens Discover against the shipped listing without GitHub. Operators can still add remote catalogs. Listing edits are source changes to `packages/host/plugin-catalog/catalog.json`.
