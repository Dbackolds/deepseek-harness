# @deepseek-ai/dsh-tool-session-control

[English](README.md) | 中文

[`ctx.sessionControl`](../session-control/README.md) 的面向模型消费方：`session_control_search`、`session_control_stop` 和 `session_control_send`。

已发布的 base 组合挂载该包。加载内置 [`dsh-session-control` skill](../../skill/skill-session-control/README.md) 可获得告诉模型何时使用这些工具的目录指令。

## 工具

- `session_control_search(query?, limit?)` 按最新优先列出带实时状态的目录行。
- `session_control_stop(session_id)` 停止当前轮次并保留已排队的收件箱工作。
- `session_control_send(session_id, message, mode?)` 向在线 Agent 投递一块文本。

## Model Experience

### Tool schemas

#### What the model sees

The generated [`session_control_search`, `session_control_stop`, and `session_control_send` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-session-control).

#### Token effect

Three fixed schemas are sent on each request while visible.

#### KV Cache effect

Prefix-stable while the tool definitions stay unchanged.

## Known Limitations and Deferred Work

- 这些工具不恢复冷会话。对仅存于存储的身份发送会失败，而不是拿走 `AgentHandle`。
- 搜索不检查消息正文。
