# Agent Note: Bundled session-control skill and tools

Status: implemented

[English](2026-08-19-bundled-session-control-skill.md) | 中文

## Problem

`ctx.sessionControl` 可以搜索全部逻辑会话、停止一轮并投递后续消息，但模型看不见这项能力。父到子的 `send_message` 和可选的 `session_search` 都不会教平级会话工作流。

## Decision

`@deepseek-ai/dsh-skill-session-control` 是一个原生 Cordis 插件，会在 `ctx.skills` 上注册一个不可变的内置提供方。该提供方负责 `dsh-session-control` 的摘要和指令正文。`dsh-tool-skill` 仍是目录与 loader 渲染的唯一归属方。

`@deepseek-ai/dsh-tool-session-control` 注册 `session_control_search`、`session_control_stop`、`session_control_send`、`session_control_workspaces`、`session_control_archive`、`session_control_unarchive`、`session_control_rehome` 和 `session_control_reorder`。搜索、停止和发送仍是 `ctx.sessionControl` 上的薄适配器。库管理工具调用 `ctx.workspaceRegistry`，改挂在存在 `ctx.apiProxy` 时走 Host `session.rehome`。已发布的 base 组合同时挂载该 skill 和这些工具。skill 告诉模型在跨会话协调或管理对话库前先加载这些指令，并使用这些工具而不是仅限父级的 `send_message`。

对仅存于存储的身份发送仍会以服务的 resume-required 错误失败。发送、停止和搜索不调用 `ctx.agents.resume()`。经 Host 改挂可以恢复冷会话，因为 Host resolver 会保留 `AgentHandle`。没有 Host 时，对仅存于存储的会话改挂会失败。

跨组移动会改对话家。同组调序走 `insertSessionBefore`，不改 cwd。`move_agent_to_root` 仍是 session-rehome 插件里当前会话的确认工具。

## Alternatives considered

- **只有 skill、没有工具** — 否决，因为目录条目不能执行搜索、停止或发送。模型将没有可调用的面。
- **教 `run_code` 调用 `ctx.sessionControl`** — 否决，因为 Code Mode 不是默认已发布目录，而且该能力应作为普通工具可见。
- **复用 `session_search` / `send_message`** — 否决，因为那些面是经工作区授权的历史搜索和父到子后续操作，不是平级会话目录。

## Consequences

默认 Web 组合会公布 `dsh-session-control` 并暴露八个 `session_control_*` 工具。CLI 和 TUI 组合挂载同一插件但不挂载 `workspaceRegistry`，因此只暴露搜索、停止和发送。冷发送仍是由所有者持有的 Host 或 continuation-manager 操作。包测试钉住提供方生命周期和工具分发；生成的工具目录会收割 schema。归档逆向 RPC 记录在[会话归档](2026-07-31-session-archive-global-set.md)。
