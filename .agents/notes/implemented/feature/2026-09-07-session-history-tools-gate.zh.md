# Agent Note: 会话历史工具门控归用户所有

Status: implemented

[English](2026-09-07-session-history-tools-gate.md) | 中文

## Problem

会话历史检索工具（第三方插件注册的 `agent_session_*` 全家，以及组合进来时的核心 `session_search` 全家）全局注册、对所有 Agent 永远可见，工具描述又主动宣传「找回之前的工作」。模型在不确定时把它们当成免费长期记忆：搜索、追命中、把任务阻塞在全文扫描上。该能力的真实价值只在用户明确想要回顾历史对话时成立，因此可用性必须由用户拥有。

## Decision

`packages/session-query/session-history-gate`（组合进 dsh-base，所有 dsh-base profile 生效）持有 `session-history-tools` 用户设置命名空间（`{ enabled: boolean }`，默认 `false`，live 生效）。关闭时：每个 Agent scope 通过 `tools.restrict({ deny })` 隐藏配置的工具名——`agent/created` 时施加，`tools/change` 与设置切换时对 `agents.list()` 全体重算，解除器记录在 `WeakMap<Agent, () => void>`，插件卸载时显式提起——并由一个补偿 prompt section（中央槽位 `SESSION_HISTORY_GATE`，紧随 `TOOL_SESSION_QUERY` 之后）告知模型：该能力被用户设置关闭、调用不会成功、任务确实需要回顾历史会话时应请用户在设置中开启。打开时：无限制、无 section。无 settings provider 时永久关闭（fail-closed）；provider 掉线同样回落关闭。`tools` 配置字段默认列出八个会话历史工具名，可在 cordis patch 层覆写；`run_code`、重复与空集在加载期拒绝；未注册的名字在运行期跳过而不抛错。

Web 侧 `packages/client/ui-session-history-gate` 在设置 → General 注册一行复选框，经 `ctx.settingsScope` 读写同一命名空间：乐观更新、写失败回退、文档不可写时禁用控件。

## Alternatives considered

**在 `dsh-session-search-pro` 插件内加开关。** 否决：第三方包升级即丢改动；核心 `session_*` 工具也需要同一扇门。

**进程级 `tools.restrict()` deny。** 否决：registry 拒绝 context-global restriction——每个 Agent scope 自持可见性；按 `agent/created` 逐 Agent 施加即可覆盖子代理与 teammate。

**执行期 guard 拒绝而非可见性移除。** 否决：schema 仍在，模型会继续调用并收集报错——正是要消除的阻塞形态；`restrict()` 让 schema 组装与执行查找（`UNKNOWN_TOOL`）一起收敛。

**默认把 `session_control_*` 一并门控。** 否决：那是用户主动发起的库管理操作，不是 agent 自发的回忆检索；部署需要时经 `tools` 配置追加即可。

## Consequences

- 默认组合下模型看不到任何会话历史检索工具，也看不到「去搜索」的诱导文案；取而代之是一行说明该能力被用户关闭及开启路径。
- 切换是 live 的：下一次 step 组装即生效（schema 按 step 从 registry view 读取），无需重启会话。
- 第三方插件自带的 prompt 广告文案无法移除；补偿 section 排在其后声明工具当前不可用。
- 门控名集是部署配置而非代码常量：新工具名只需在 cordis patch 加一行。
