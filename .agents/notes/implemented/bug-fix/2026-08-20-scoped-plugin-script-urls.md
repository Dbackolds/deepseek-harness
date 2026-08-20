# Agent Note: Scoped client plugin script URLs

Status: implemented

English | [中文](2026-08-20-scoped-plugin-script-urls.zh.md)

## Problem

Every web `dsh.client` package is a scoped npm name. The modules node half put that name into `window.__DSH_BOOT__` as `/plugins/@scope/name/client.js?rev=…`. A classic `<script src>` treats `@` as illegal in a path, so Chromium never requests the Host and the loading page reports `bundle script … failed to load`. Desktop launch overlapped Host bind with later `/plugins` registration, so the first scripts could 404 even after that URL was legal.

## Decision

`graphRow` percent-encodes each path segment of the package name (`@deepseek-ai` → `%40deepseek-ai`). The `/plugins` handler still `decodeURIComponent`s the request pathname before table lookup, so encoded and decoded lookups resolve to the same row. Desktop waits for a GET of `/plugins/%40deepseek-ai/dsh-client-modules/client.js` after the Host prints its loopback URL, and the browser loader retries a first-scan script miss while later Host rows finish mounting.

## Alternatives considered

**Leave `@` unencoded and rely on Chromium to fetch it.** Rejected: Electron's Chromium rejects the URL before any Host request, so retries and a ready probe cannot recover.

**Serve plugins under an unscoped alias.** Rejected: the graph id is the package name; a second identifier would split the boot row, the script URL, and the factory handoff.

**Probe with HEAD.** Rejected: `/plugins` answers GET only. A HEAD probe 405s forever and leaves the window on the loading page.

## Consequences

Scoped plugin scripts become legal URLs. Desktop still races Host bind against later rows, but it no longer loads the GUI until one encoded client bundle answers GET. A Host whose marketplace node half is missing `lib/index.js` still fails at profile load; that is a source-build miss, not this URL encoding.

## Testing

`packages/client/modules/tests/node-half.client.spec.ts` asserts the encoded graph URL and a GET of that encoded path. `apps/desktop/tests/host.spec.ts` asserts the desktop probe uses the encoded modules bundle path and GET. `packages/client/modules/tests/loader.client.spec.ts` retries a first-scan script miss.
