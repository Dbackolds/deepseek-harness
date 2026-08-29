# @deepseek-ai/dsh-client-ui-update

English | [中文](README.zh.md)

Host poller and browser Settings row for product updates. The Host half polls GitHub Releases on a 24h interval, caches the last successful result in the `product-update` settings namespace, and serves `/product-update` over a loopback RPC channel. The browser half mounts a General Settings row and a shell overlay toast. Checking never downloads or installs an artifact; **Open release** opens the GitHub URL.

Channel selection is `auto` by default: `DSH_PRODUCT_CHANNEL=desktop` (set by the Electron window when it spawns `dsh web`) matches `desktop-v*` tags, otherwise `dsh-v*`. The compared version is `DSH_PRODUCT_VERSION` when set, else the published CLI package, else this package's own package.json.

## Model Experience

None, as the plugin polls GitHub and renders browser UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Never downloads or installs** — the toast and Settings row open the GitHub Release URL. Packaged desktop still has no in-app installer.
- **GitHub Releases only** — one public repo feed; no private-feed or mirror support.
- **Stale cache fallback** — a failed poll keeps the last successful result for 24h so a GitHub outage does not blank the row.
- **Unsigned desktop artifacts** — first-launch Gatekeeper / SmartScreen warnings remain a packaging concern, not this plugin's.
