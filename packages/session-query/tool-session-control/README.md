# @deepseek-ai/dsh-tool-session-control

English | [中文](README.zh.md)

Model-facing Consumer for [`ctx.sessionControl`](../session-control/README.md), [`ctx.sessionTitle`](../../session/session-title/README.md), and [`ctx.workspaceRegistry`](../../workspace/workspace/README.md): search, stop, send, rename, list workspaces, archive, unarchive, rehome, and reorder.

The shipped base composition mounts the package. Load the bundled [`dsh-session-control` skill](../../skill/skill-session-control/README.md) for the catalog instructions that tell the model when to use these tools.

## Tools

- `session_control_search(query?, limit?, archive?)` lists newest-first directory rows with live status. `archive` is `all` (default, include archived), `only`, or `exclude`. Archived rows are marked.
- `session_control_stop(session_id)` stops the current turn and keeps queued inbox work.
- `session_control_send(session_id, message, mode?)` delivers one text block to a live Agent.
- `session_control_rename(session_id, title)` pins a user-source title on any logical session. Empty titles fail. Subagent-owned sessions fail.
- `session_control_workspaces()` lists registered workspaces with archived members omitted.
- `session_control_archive(session_id)` archives one known session. Already archived is a no-op.
- `session_control_unarchive(session_id)` restores one known session. Known and not archived is a no-op.
- `session_control_rehome(session_id, path)` moves one session's home and sidebar group to an existing directory. Canonical No Repo is refused. An unregistered existing directory is registered.
- `session_control_reorder(session_id, before_session_id?)` moves an accounted session inside its current workspace. Ungrouped sessions fail.

`session_control_rehome` prefers Host `session.rehome` when `ctx.apiProxy` is present so a cold session can resume. Without Host, only a live non-subagent session can fall back to `workspaceRegistry.create` plus `setSessionHome`. A session whose header origin is `subagent` fails on that fallback.

`session_control_rename` prefers Host `session.rename` when `ctx.apiProxy` is present. Without Host, only a live non-subagent session can fall back to `ctx.sessionTitle.rename`.

## Model Experience

### Tool schemas

#### What the model sees

The generated [`session_control_*` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-session-control).

#### Token effect

Three directory schemas always; `session_control_rename` while `ctx.sessionTitle` is mounted; five library schemas while `ctx.workspaceRegistry` is mounted.

#### KV Cache effect

Prefix-stable while the tool definitions stay unchanged.

## Known Limitations and Deferred Work

- `session_control_send` does not resume a cold session. A storage-only send fails instead of taking an `AgentHandle`.
- Search does not inspect message bodies. Archived rows stay in the directory by default; grouping tools still omit them.
- Without Host `session.rehome`, `session_control_rehome` cannot resume a cold session, and a live session whose header origin is `subagent` fails.
- Without Host `session.rename`, `session_control_rename` cannot resume a cold session.
- These tools do not hide or show workspaces, and they do not open an unarchived session.
- Library tools wait on `ctx.workspaceRegistry`. CLI and TUI compositions do not mount it, so they expose search, stop, send, and rename.
