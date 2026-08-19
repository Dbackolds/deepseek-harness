# Agent Note: Bundled session-control skill and tools

Status: implemented

[English](2026-08-19-bundled-session-control-skill.md) | 中文

## Problem

`ctx.sessionControl` 可以搜索全部逻辑会话、停止一轮并投递后续消息，但模型看不见这项能力。父到子的 `send_message` 和可选的 `session_search` 都不会教平级会话工作流。

## Decision

`@deepseek-ai/dsh-skill-session-control` 是一个原生 Cordis 插件，会在 `ctx.skills` 上注册一个不可变的内置提供方。该提供方负责 `dsh-session-control` 的摘要和指令正文。`dsh-tool-skill` 仍是目录与 loader 渲染的唯一归属方。

`@deepseek-ai/dsh-tool-session-control` 注册 `session_control_search`、`session_control_stop` 和 `session_control_send`，作为 `ctx.sessionControl` 上的薄适配器。已发布的 base 组合同时挂载该 skill 和这些工具。skill 告诉模型在跨会话协调前先加载这些指令，并使用这些工具而不是仅限父级的 `send_message`。

对仅存于存储的身份发送仍会以服务的 resume-required 错误失败。这些工具不调用 `ctx.agents.resume()`。

## Alternatives considered

- **只有 skill、没有工具** — 否决，因为目录条目不能执行搜索、停止或发送。模型将没有可调用的面。
- **教 `run_code` 调用 `ctx.sessionControl`** — 否决，因为 Code Mode 不是默认已发布目录，而且该能力应作为普通工具可见。
- **复用 `session_search` / `send_message`** — 否决，因为那些面是经工作区授权的历史搜索和父到子后续操作，不是平级会话目录。

## Consequences

默认 Web 与 TUI 组合会公布 `dsh-session-control` 并暴露三个新工具。冷恢复仍是由所有者持有的 Host 或 continuation-manager 操作。包测试钉住提供方生命周期和工具分发；生成的工具目录会收割新 schema。
