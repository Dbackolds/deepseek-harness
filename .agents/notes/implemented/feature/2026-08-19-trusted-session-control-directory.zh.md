# Agent Note: Trusted session-control directory

Status: implemented

[English](2026-08-19-trusted-session-control-directory.md) | 中文

## Problem

需要查找全部会话、读取是否在跑、停止一轮或投递后续消息的宿主与插件，现在只能自行拼装 `ctx.sessionQuery`、`ctx.agents` 和 `ctx.sessions`。这会重复标题折叠、实时状态词汇和 resume 所有权围栏。现有模型工具仍是父到子，而 `session.list` 是 Host RPC，不是进程内服务。

## Decision

`@deepseek-ai/dsh-session-control` 以 `ctx.sessionControl` 发布可信进程内目录。`search()` 与 `get()` 从 `ctx.sessionQuery.listSessions()` 列出在线优先语料，为每行附加最新标题与在线 Agent 状态（`running` / `idle` / `ready`），并以不区分大小写的子串过滤会话 id、cwd 和标题。`stop()` 以 `keepInbox: true` 取消在线 Agent，并把没有驱动的已知身份视为被接受的空操作。`send()` 通过 `followup()` 或 `steer()` 投递一块非空文本，并记录来源 `{ kind: 'plugin', plugin: 'session-control' }`。

该服务从不调用 `ctx.agents.resume()`。已知但仅存于存储的身份以 `SESSION_CONTROL_RESUME_REQUIRED` 失败；未知身份以 `SESSION_CONTROL_SESSION_NOT_FOUND` 失败。resume 返回的 `AgentHandle` 必须由 Host resolver 或 subagent continuation manager 持有，共享目录若丢弃该 handle 会从这些所有者手中抢走所有权。

已发布的 base 组合挂载该包。它不注册面向模型的工具，也不做调用方授权。

## Alternatives considered

- **加宽 `ctx.sessionQuery`** — 否决，因为 query 是只读语料服务。停止与投递会变更在线 Agent，不应落在同一键上。
- **复用 `send_message` / `session.prompt`** — 否决，因为那些面是父级授权或 Host RPC。进程内插件需要同一进程 API，才能在没有父 Agent 或线载荷的情况下寻址任意在线会话。
- **在 `send()` 内恢复冷会话** — 否决，因为 `AgentHandle` 所有权已被 Host resolver 与 continuation manager 认领。再拿第二个 handle 会在 dispose 时冲突。
- **搜索消息正文** — 否决，因为 `ctx.sessionQuery.searchSessions()` 已经拥有全文发现，且默认组合关闭该索引。

## Consequences

插件可以枚举全部逻辑会话、读取实时状态、停止一轮并投递后续消息，而不再重复标题折叠或 resume 围栏。冷投递仍要求调用方通过会保留 handle 的所有者去 resume。默认 Web 与 TUI 组合获得该服务；模型看不到新工具。
