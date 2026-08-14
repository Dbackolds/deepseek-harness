# @deepseek-ai/dsh-tool-automation

[English](README.md) | 中文

[`ctx.automation`](../automation/README.md) 的面向模型 Consumer：`automation_list`、`automation_create`、`automation_update`、`automation_delete` 和 `automation_set_enabled`。

## 工具

- `automation_list()` 返回每条规则及其 `state` 和 `nextAt`。
- `automation_create(...)` 需要非空 `task` 和恰好一个选择器。省略 `workspace_id` 时使用当前会话 workspace。省略 `permission_preset` 时保留用户默认；无人值守写入必须点名 `danger-full-access`。`on_overlap` 默认为 `skip`。
- `automation_update(id, ...)` 应用稀疏 patch。改日程时仍需要恰好一个选择器字段。
- `automation_delete(id)` 删除规则并保留 run 历史。
- `automation_set_enabled(id, enabled)` 武装或解除武装，不改写选择器。

五个调用都是 exclusive。UI 客户端收到 generic 卡片。

## 权威

mutate 需要精确的 live root Agent、打开的 turn，以及该 turn 里的 `{ kind: 'user' }` 消息。省略 source 的 `Agent.followup()` 和插件开火会继承 `user`，因此 Automation 自己必须传 `{ kind: 'plugin', plugin: 'automation' }`。子 agent 不接收这些 tool。

## 模型体验

### 作用域管理工具

#### 模型看到什么

本插件加载之后创建的 root Agent 能看到五份生成 schema。结果是服务视图的规范 JSON。

#### Token 影响

插件安装期间，schema 增加固定请求前缀。每次调用通过普通 tool-result 管道追加其 JSON 结果。

#### KV Cache 影响

定义不变时 schema 保持前缀稳定。调用追加到后续历史。

## 已知限制与推迟工作

- **没有 `automation_run_now` tool** — 手动开火留在 Host RPC / Settings 路径，避免模型在对话里无日程地再开一条 Session。
