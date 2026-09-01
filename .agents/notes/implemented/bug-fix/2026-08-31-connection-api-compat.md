# Agent Note: Restore connection.api for Client plugins

Status: implemented

English | [中文](2026-08-31-connection-api-compat.zh.md)

## Problem

The Typert Remote split removed `connection.api`. Client plugins compiled against the earlier unary face still call `connection.api.llm.providers`, `llm.models`, `settings.describe`, and `settings.update`, and unwrap `response.result`. With the slot gone, those plugins throw `Cannot read properties of undefined (reading 'llm')` / `'settings'` as soon as their settings page mounts. `@dsh-plugin/dsh-auxiliary` is the live consumer: its Auxiliary Models page reads that face and cannot configure vision or compaction routes.

Current product surfaces already use `ctx.remote.llm` and `ctx.remote.settings`. The missing piece is only the historical envelope those plugins still compile against.

## Decision

Keep `ctx.remote` as the product API. After API Remotes mounts the selected namespaces, install a compatibility `connection.api` on the live Connection handle:

- `llm.providers` joins `listProviders` with `listConfigurableProviders` into the historical provider rows (`provider`, `displayName`, `settingsNs`, `active`).
- `llm.models` builds provider groups from the redacted `llm-pi-ai` settings document and live routes. Groups without advertised models are omitted.
- `settings.describe` / `settings.update` wrap the current Remote methods and return `{ rpcId, result }`.

The slot is optional on `ConnectionHandle`. Connection does not populate it; Remotes restores the previous value when the assembly unloads. New surfaces must call `ctx.remote`.

`$mount` installs each namespace on a cousin fiber. The Remotes client fiber only injects `remote`, so `ctx.remote.llm` / `ctx.remote.settings` throw `cannot get property "remote.<namespace>" without inject`. After mounts settle, a child fiber that injects those two names reads the handles and installs the face.

## Alternatives considered

- **Patch each installed plugin in `$DSH_HOME/profiles`.** That repair does not survive `dsh plugin add` or an upgrade, and every other plugin on the old face stays broken.
- **Put the adapter in Connection.** Connection must not depend on the Remote namespaces it does not own. The assembly that mounts `llm` and `settings` is the only place that can install a complete face.
- **Reintroduce a first-class unary client next to `ctx.remote`.** That duplicates the Remote map and invites new code to keep using the old envelope.

## Consequences

Plugins that still call `connection.api` for those four methods work after a Host rebuild and page reload. The face covers only that historical subset. Catalog groups come from the settings document, not a Host `listModels` Remote, because that method is not on the Client Remote map.

## Testing

`packages/api/remotes/tests/connection-api.client.spec.ts` covers provider joining, catalog grouping, Remote-failure forwarding, and install/restore of the Connection slot. `packages/api/remotes/tests/client-apply.client.spec.ts` covers the cousin-fiber inject path the loader uses.
