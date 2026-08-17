# `@deepseek-ai/dsh-host-plugin-catalog`

English | [中文](README.zh.md)

Serves the shipped StarPivot plugin catalog on the Host webserver at `/plugin-catalog/catalog.json`. The document is marketplace protocol version 1 and lives beside this package as `catalog.json`. Discover and other catalog clients fetch that exact path; the in-box marketplace resolves it against the live webserver port.

The route is effect-scoped: disposing the plugin's fiber removes it, after which the unclaimed path answers 404 (or the SPA fallback once that seat is claimed).

## Model Experience

None, as the package serves a browser/Host JSON catalog; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The listing is a shipped pin** — adding or rewriting a row is a source edit of `catalog.json` in this package, not a live scrape of npm.
