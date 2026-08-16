# Agent Note: The shipped Plugins settings row yields to an out-of-tree marketplace

Status: implemented

English | [中文](2026-08-16-plugins-settings-marketplace-yield.zh.md)

## Problem

An out-of-tree marketplace (`@starpivot/dsh-plugin-marketplace`) mounts over the shipped Plugins settings page: it provides `pluginMarketplaceUi` and registers `settings.section` id `plugins` at the default priority. The shipped `dsh-client-ui-settings-plugins` row used the same id at the same priority, so installing the marketplace failed the browser Loader with a duplicate-cell error and left the GUI on the boot failure page.

## Decision

The shipped Plugins nav row registers at `priority: 1`. A marketplace that occupies the same cell at priority `0` is the shadowing winner (lowest priority renders) and does not collide. The shipped plugin also watches `internal/plugin` for the marketplace Loader entry name `@starpivot/dsh-plugin-marketplace` (`fiber.entry.options.name`, not `runtime.name` — dual-face client modules export `{ apply, inject }` and leave `runtime.name` unset) and tears down its nav row plus `configurable` tab before that fiber's `apply` runs, because the marketplace declares `settings.plugin.item`. The three host-plane cards still inject into that item slot once the marketplace page is live.

`dsh-app-boot` also exports the profile mutation helpers the marketplace Host half imports (`packageExportsBundle`, `reconcileProfilePlugins`, `runProfilePnpm`, `readProfilePatches`, `writeProfilePatches`) and a profile boot publishes `ctx.profile` through `provideProfile`. Those helpers are the same files `dsh plugin` mutates.

## Alternatives considered

- **Matching `runtime.name`**: the browser Loader passes the raw module namespace to `ctx.plugin()`, so `runtime.name` is undefined unless the package exports `name`. The package id is on the Loader entry.
- **Unregistering the shipped row on `internal/service`**: `provide` during a LOADING fiber does not notify until that fiber becomes ACTIVE, which is after the marketplace has already registered the cell.
- **Making the marketplace register at a non-zero priority**: that package is out of tree and already ships without a `priority` field; the shipped row must leave the default cell free.
- **Disabling the shipped `ui-settings-plugins` Host row from the marketplace patch**: that would also drop the three host-plane cards and the tab chrome those cards register into.

## Consequences

- Installing the public marketplace no longer fails browser boot solely because both packages name the Plugins nav row.
- A marketplace that neither provides `pluginMarketplaceUi` nor registers at priority `0` still collides if it reuses id `plugins` at priority `1`.
- The shipped `configurable` tab stays off while a marketplace owns the page; the three cards still appear if that page declares `settings.plugin.item`.
