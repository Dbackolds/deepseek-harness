---
description: "用户设置门控：在启用前对每个 agent 隐藏会话历史工具，面向把既往会话召回编入部署的运维者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-session-history-gate

[English](README.md) | 中文

## 概述

`dsh-session-history-gate` 让面向模型的会话历史工具变成显式启用。门控关闭（默认）时，配置的工具名——第三方搜索插件注册的 `agent_session_*` 家族加上核心的 `session_*` 查询工具——会被从每个存续 Agent 上限制掉：它们的 schema 从各 agent 视图消失，执行被门控的名称以 `UNKNOWN_TOOL` 失败。一个补偿性系统提示词章节告知模型该能力已被用户设置禁用，并在任务确实需要既往会话召回时引导模型请用户启用。把 `session-history-tools` 实时设置打开后，工具会在每个存续会话的下一次模型请求重新可见，无需重启。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

当会话历史工具被全局注册、但必须等到用户明确想要会话召回时才可见时，挂载本包。门控组合在工具注册表之上：它自身不注册工具，也不改变被门控包的注册内容——它按 Agent 限制其可见性。

### 何时选择它

当部署携带会话历史搜索（`dsh-tool-session-query`、`dsh-session-search-pro`）、但希望召回由用户拥有而非模型的免费记忆时选择它。组合中没有 settings provider 时，门控永久关闭（fail-closed）：限制与补偿章节持续生效，且没有任何开关能打开它们。

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `tools` | 八个名称的会话历史家族 | 关闭期间被隐藏的全局工具名；未注册的名称会被跳过，重复项折叠，`run_code` 在加载时被拒绝 |

默认集合为 `agent_session_list`、`agent_session_read`、`agent_session_search`、`session_search`、`session_event_search`、`session_trace`、`session_event_trace`、`session_event_read`。生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-session-history-gate)是每个受支持字段及其 JSDoc 的详尽来源。

### 关闭与打开行为

关闭期间，门控加载前后创建的每个 Agent——包括 subagent 与 teammate——都会在自己的作用域内拒绝当前已注册的被门控名称；晚注册的门控工具会在下一次注册表变更时被纳入。打开期间不存在任何限制，补偿章节被销毁。切换 `session-history-tools` 设置会销毁或重新应用每个存续 agent 的限制；变更在下一次 step 组装时可见，因为 schema 按 step 读取。settings provider 中途丢失会把门控再次关闭。

-----

<a id="model-experience"></a>
## 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

`tools/change` 的重算在 `appliedDeny` 集合相等时短路，而重算本身经由 `restrict()` 与解除器同步发出的通知由单趟 `reconciling` 标志跳过；这两个守卫缺一不可。扩展闸门时保持该重入形态，并把新的门控名称放进默认 `tools` 列表，而不是写死在监听器里。

</details>

## 模型体验

### 系统提示词

#### 模型看到什么

门控关闭期间，模型会收到一个固定章节，说明该能力已被用户禁用并给出启用路径。

##### 会话历史门控提示

```markdown
Session-history tools such as agent_session_search and session_search are disabled by a user setting; calling them will not work. Do not attempt them. When your task genuinely needs recalling prior sessions, ask the user to enable "Session history tools" in Settings.
```

#### Token 影响

条件性：该章节仅在门控关闭时存在；打开后整段移除。

#### KV Cache 影响

关闭状态与文本不变时前缀稳定；切换门控会替换该章节的 token，并从其位置起使重用失效。

### 被门控的工具可见性

#### 模型看到什么

门控自身不贡献任何工具；关闭期间它把被门控工具的 schema 从每个 agent 的请求中移除，打开期间这些 schema 与其所属包注册的内容完全一致地随请求发送。

#### Token 影响

条件性：被门控的 schema 在关闭期间缺席，设置打开后重新出现。

#### KV Cache 影响

切换会添加或移除工具块位置上的 schema token，并从该位置起使重用失效；开关状态不变时保留可重用前缀。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明本包何时不合适，或何时需要特别的运维注意。它们是当前包约束，不是任务积压。

- **仅一个主机级全局开关** — 打开/关闭状态作用于进程内的每个 Agent；按 preset 或按会话的粒度超出范围。
- **Agent 自有遮蔽仍然可见** — 在 Agent 自身作用域注册的门控名称（preset 覆盖）对该 agent 保持可见，因为限制只过滤继承来的全局注册。
- **无 provider 时 fail-closed** — 没有 settings provider 的组合会让门控永久关闭；要打开就必须组合一个 provider。

**运行时不变量：** 不发布 companion。除了已经校验注册的工具、系统提示词与 settings 注册表之外，门控不拥有任何事件或可变数据关系。
