# @deepseek-ai/dsh-session-route

[English](README.md) | 中文

注册 `requestRoute` projection 单元的函数插件：对整个会话日志的 `request/header` 事件做 latest-wins 折叠，得到已派发的请求路由——provider、model 与可选的 reasoning effort——经 session-projection 缝对外提供（registry 快照、变更流，以及每一个 projection 载体：history 尾页、`session/projection` 推送帧、会话列表行）。客户端由此读到会话实际运行的模型——这是一个分页与压缩都无法改变的全日志事实，且从不参考 composer 选择器状态；参考消费者是 Web 聊天的头部身份标签与逐步模型行。

## 折叠语义

- 最新的 `request/header` 获胜。快照是完整值：agent loop 在每次派发前，仅当请求头与持有者不同时（外加每个 loop 实例的首次派发）在步内追加一条，因此仅凭重放顺序即可决定取值——与 `foldRequestHeader`（dsh-session）对相同事件施加的 latest-wins 规则一致。
- 只保留身份三元组——请求头 `config` 中的 `provider`、`model`、`reasoningEffort`。系统提示词、工具 schema、adapter-default 标记全部丢弃：本单元回答“哪条路由”，从不回答“发了什么”。请求头未携带 effort 时，值中也不出现 `reasoningEffort`。
- `reason`——`'initial'`、`'resume'`、`'change'`——从不影响服务的值。
- 日志出现首个请求头之前，值为 `null`（与 `title`、`goal` 单元的无值约定一致）。已装配的 registry 恒提供该键，客户端读取值本身，而非键的存在性。
- 与已折叠路由相同的路由（进程重启后重新记录的同一请求头）返回相同的状态引用，变更流保持安静；Object.is 决定下游是否有工作。

## 组合

```yaml
- id: session-route
  name: '@deepseek-ai/dsh-session-route'
```

注入 `sessionProjections`——这是插件的全部用途；在没有 registry 的装配中 fiber 保持挂起，不注册任何内容。

## 模型体验

无，因为插件只把已写入日志的请求头折叠为面向客户端的读模型，不触碰任何提示词、消息、schema、流或工具结果。

#### KV Cache 影响

无；插件从不组装或发送提供方请求。

## 已知局限与延后工作

- **是路由身份，不是实际服务凭据**——值是最新写入日志的请求头，不是“哪台 adapter 实际服务了某条消息”的逐响应记录；日志看不见的提供方侧重路由不会反映在这里（逐消息的凭据是 `assistant/message.source`）。
- **全日志 latest-wins，不是逐轮历史**——请求头一经写入不会撤销，因此会话中途切换后，值对整个会话都指向新路由；解析“更早的某步由哪条路由服务”是消费者的按键连接（trajectory 的 `headerFor` 模式），不是本单元的职责。
- **裸 id，无显示名**——`provider` 与 `model` 逐字保留日志中的 id；目录显示名与 effort 标签的解析由消费者的目录查询完成。
- **仅挂载于 web-app bundle**——其他装配不提供 `requestRoute` 键，其消费者回退到自己的派生逻辑。
