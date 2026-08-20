# @deepseek-ai/dsh-skill-session-control

English | [中文](README.zh.md)

Bundled skill provider that contributes `dsh-session-control` to `ctx.skills`. The skill tells the model when and how to use the `session_control_*` tools to search every logical session, stop a turn, deliver a later message, or archive, unarchive, and regroup conversations.

The shipped base composition mounts the plugin. It has no configuration. A user-owned skill of the same name still wins through ordinary registry precedence.

The provider exposes its packaged `assets/` directory as the skill resource base.

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-skill`, which renders the catalog entry and selected skill body.

#### KV Cache effect

The catalog entry and any loaded body change the provider KV prefix at their insertion points.

## Known Limitations and Deferred Work

- The provider contributes one fixed skill and has no runtime customization.
- The skill does not resume a cold session for send. A storage-only identity still requires an owner that keeps the `AgentHandle`.
- Library tools do not add a sidebar unarchive surface.
