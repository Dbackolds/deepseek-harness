# @deepseek-ai/dsh-client-ui-settings-skills

English | [中文](README.zh.md)

The **Skills** settings section. The page lists every skill the Host registry currently discovers — built-in providers such as `dsh-badge`, user and project filesystem roots, and runtime contributions — as searchable disclosure cards. It registers no slash command and writes nothing.

The nav row sits between Plugins and Agent presets (`order: 17`). The first mount calls `skill.catalog`; that RPC is session-independent and merges the host global layer with the deployment default preset's standing layer, so a Web composition that disables the host `skill-filesystem` row still shows the preset-owned user, project, and bundled skills.

Each collapsed card shows the skill name, description, and a source tag. Expanding one card reveals the origin bucket, provider name, and the two invocation flags. Loading, empty, no-match, and generic failure states stay local to the mounted component; a failed read can be retried without exposing transport details.

## Model Experience

None, as the section renders a browser catalog; invocation remains an ordinary `/name` prompt handled by `dsh-tool-skill`.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Read-only catalog** — the page does not create, edit, delete, or toggle skills.
- **One snapshot per Settings mount or retry** — the page does not subscribe to `skills/change` or automatically refetch after reconnect.
