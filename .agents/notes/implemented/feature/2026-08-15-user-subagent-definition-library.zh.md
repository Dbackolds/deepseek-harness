# Agent Note: User-authored subagent definition library

Status: implemented

[English](2026-08-15-user-subagent-definition-library.md) | 中文

## Problem

父级可以用 persona 和工具过滤启动子代理，但这些值活在工具实例或启动请求上。产品用户如果想要可复用的评审、研究或写作者角色，没有设置页来存这些定义，模型也无法按名字选用。

设置对话框已经拥有模型、插件、Agent 预设和系统提示词。定义库属于这些产品面：放在模型与插件之间，作为模型可以选用的具名子代理组合。

## Decision

Settings 分节 `user-subagents` 存储一份进程范围的具名子代理定义库。每条定义有 id、显示名、简短说明、persona，以及可选的 `allow` / `deny` 工具列表。Web 设置页位于模型与插件之间，负责创建、编辑、删除。写入走 `settings.replace`。

`dsh-user-subagents` 用空的组合配置项注册该分节，并发布 `ctx.userSubagents`。`dsh-tool-subagent` 读取实时库。库非空时，父级 `subagent` 工具会增加可选的 `agent` 枚举。选中一个 id 后，在启动时应用该定义的 persona 与工具过滤。省略 `agent` 则沿用该工具实例已配置的组合。未知 id 在工具边界失败。

一条定义不选择提供方、模型或深度上限。这些仍由工具实例配置决定。库行后来被编辑或删除时，已在运行的子代理保持它启动时的组合。

## Alternatives considered

为每条定义挂一个 `tool-subagent` 实例，会给每行一个自己的工具名。这会倍增面向模型的工具，并且仍然需要设置页来增删实例。一个工具加上 `agent` 枚举，可以保留现有的 `subagent` / `subagent_fork` 名称。

为每个子代理编写完整的 agent 预设，会复用预设名册。预设拥有整份组合，而不是可复用的子代理 persona。该库是父级在启动时应用的更小对象。

## Consequences

父级工具 schema 会随每条列出的定义 id 与说明增长。创建、重命名、删除或重排一条定义，可能从第一个变化的工具 schema token 起使 KV cache 复用失效。

该库是进程范围的。每个能调用 `subagent` 的父级都看到同一组行。设置页上的工具名需手写；该页不列出实时的全局目录。

## Testing

Host 单元测试覆盖校验、查找、组合映射以及 Settings 分层。委派工具套件覆盖空库省略 `agent`、列出的枚举应用所选组合，以及未知 id 失败。Web 设置页有 apply、store 和组件覆盖，以及 settings-chrome 快照和经过新导航行的 e2e 切换。
