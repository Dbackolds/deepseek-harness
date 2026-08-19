# dsh-client-ui-settings-subagents

English | [中文](README.zh.md)

The **Subagents** settings section. The page owns busy-state delivery preferences and the user definition library: create, edit, and delete reusable child personas and optional tool filters.

The Behavior group writes `subagent-delivery` (`settlementBusy`, `reportBusy`, `jobBusy`: `steer` or `queue`, default `steer`). Library writes go through `settings.replace` on the `user-subagents` namespace. The Host plugin [`dsh-user-subagents`](../../subagent/user-subagents/README.md) serves the live library; [`dsh-tool-subagent`](../../subagent/tool-subagent/README.md) applies a selected definition at start. Runtime readers honor the delivery section at send time.

The nav row sits between Models and Plugins (`order: 12`). A deployment that does not expose the namespace renders the unavailable line rather than an editor.

## Model Experience

None, as the section renders a browser configuration UI; the values it writes reach a model only through `dsh-user-subagents` and `dsh-tool-subagent`.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Tool names are typed by hand** — the page does not list the live global tool catalog.
- **A definition cannot choose a provider or model** — those remain tool-instance configuration.
