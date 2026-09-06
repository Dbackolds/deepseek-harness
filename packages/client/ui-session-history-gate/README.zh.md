# @deepseek-ai/dsh-client-ui-session-history-gate

[English](README.md) | 中文

## 概述

「通用设置」中控制模型侧会话历史工具的开关行。Host 侧的闸门、设置 schema 与工具限制属于 host 端插件 `@deepseek-ai/dsh-session-history-gate`（`packages/session-query/session-history-gate`）；本包只把该插件的 `session-history-tools` 命名空间绑定进 `settings.general.item`。

该行是架在 `SettingsScope` 镜像上的一个复选框：渲染已接受的分节，写入时先乐观生效，写入未落地则回退到 Host 值。命名空间未开放或文档只读时复选框保持禁用——与 Host 闸门同样的失败关闭姿态。不发布 `./invariant`：除 Host 闸门已注册的能力外，本包没有独立的运行时关系。

## 目录

- [概述](#summary)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

本行不注册任何 host 能力；命名空间 schema 与 live 语义属于 Host 闸门插件。写入路径保持 `scope.set` 加「先乐观后采纳」的顺序——控制器经 `adopt()` 回退，不走错误横幅。

</details>

## 模型体验

通过 Host 闸门间接影响：开关关闭时，agent 看不到 `agent_session_*` / `session_search` 工具 schema，一段提示说明会引导它在任务确实需要回顾历史对话时请用户打开该行。

#### KV Cache 影响

切换该行会改变每个活跃会话下一次模型请求的工具 schema 与提示分节；该行本身不携带对话内容。

## 已知限制与延期工作

- 只有一个 Host 全局开关；没有按会话或按 preset 的粒度（依规格）。
