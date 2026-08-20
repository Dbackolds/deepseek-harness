# @deepseek-ai/dsh-skill-session-control

[English](README.md) | 中文

内置 skill 提供方，向 `ctx.skills` 贡献 `dsh-session-control`。该 skill 告诉模型何时以及如何使用 `session_control_*` 工具，以搜索全部逻辑会话（默认包含已归档行）、停止一轮、投递后续消息、改名，或归档、取消归档并改挂对话。

已发布的 base 组合挂载该插件。它没有配置。同名的用户 skill 仍通过普通注册表优先级胜出。

提供方把它打包的 `assets/` 目录公开为 skill 资源基底。

## Model Experience

Indirectly, through `@deepseek-ai/dsh-tool-skill`, which renders the catalog entry and selected skill body.

#### KV Cache effect

The catalog entry and any loaded body change the provider KV prefix at their insertion points.

## Known Limitations and Deferred Work

- 该提供方贡献一个固定 skill，没有运行时定制。
- 该 skill 不为发送恢复冷会话。仅存于存储的身份仍需要会保留 `AgentHandle` 的所有者。
- 库管理工具不提供侧栏取消归档入口。
