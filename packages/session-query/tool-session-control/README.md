# @deepseek-ai/dsh-tool-session-control

English | [中文](README.zh.md)

Model-facing Consumer for [`ctx.sessionControl`](../session-control/README.md): `session_control_search`, `session_control_stop`, and `session_control_send`.

The shipped base composition mounts the package. Load the bundled [`dsh-session-control` skill](../../skill/skill-session-control/README.md) for the catalog instructions that tell the model when to use these tools.

## Tools

- `session_control_search(query?, limit?)` lists newest-first directory rows with live status.
- `session_control_stop(session_id)` stops the current turn and keeps queued inbox work.
- `session_control_send(session_id, message, mode?)` delivers one text block to a live Agent.

## Model Experience

### Tool schemas

#### What the model sees

The generated [`session_control_search`, `session_control_stop`, and `session_control_send` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-session-control).

#### Token effect

Three fixed schemas are sent on each request while visible.

#### KV Cache effect

Prefix-stable while the tool definitions stay unchanged.

## Known Limitations and Deferred Work

- The tools do not resume a cold session. A storage-only send fails instead of taking an `AgentHandle`.
- Search does not inspect message bodies.
