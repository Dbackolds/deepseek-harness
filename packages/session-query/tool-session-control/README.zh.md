# @deepseek-ai/dsh-tool-session-control

[English](README.md) | 中文

[`ctx.sessionControl`](../session-control/README.md) 与 [`ctx.workspaceRegistry`](../../workspace/workspace/README.md) 的面向模型消费方：搜索、停止、发送、列出工作区、归档、取消归档、改挂与同组调序。

已发布的 base 组合挂载该包。加载内置 [`dsh-session-control` skill](../../skill/skill-session-control/README.md) 可获得告诉模型何时使用这些工具的目录指令。

## 工具

- `session_control_search(query?, limit?)` 按最新优先列出带实时状态的目录行。
- `session_control_stop(session_id)` 停止当前轮次并保留已排队的收件箱工作。
- `session_control_send(session_id, message, mode?)` 向在线 Agent 投递一块文本。
- `session_control_workspaces()` 列出已注册工作区，并省略已归档成员。
- `session_control_archive(session_id)` 归档一个已知会话。已归档则成功且不写入。
- `session_control_unarchive(session_id)` 恢复一个已知会话。已知且未归档则成功且不写入。
- `session_control_rehome(session_id, path)` 把一个会话的家和侧栏分组迁到已存在目录。规范 No Repo 目录会被拒绝。未注册的已存在目录会先注册。
- `session_control_reorder(session_id, before_session_id?)` 在当前工作区内移动一个已记账会话。未分组会话会失败。

`session_control_rehome` 在存在 `ctx.apiProxy` 时优先走 Host `session.rehome`，以便恢复冷会话。没有 Host 时，只有在线会话能回退到 `workspaceRegistry.create` 加 `setSessionHome`。

## Model Experience

### Tool schemas

#### What the model sees

The generated [`session_control_*` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-session-control).

#### Token effect

Three directory schemas always; five library schemas while `ctx.workspaceRegistry` is mounted.

#### KV Cache effect

Prefix-stable while the tool definitions stay unchanged.

## Known Limitations and Deferred Work

- `session_control_send` 不恢复冷会话。对仅存于存储的身份发送会失败，而不是拿走 `AgentHandle`。
- 搜索不检查消息正文。
- 没有 Host `session.rehome` 时，`session_control_rehome` 不能恢复冷会话。
- 这些工具不隐藏或显示工作区，也不会打开已取消归档的会话。
- 库管理工具等待 `ctx.workspaceRegistry`。CLI 和 TUI 组合不挂载它，因此只暴露搜索、停止和发送。
