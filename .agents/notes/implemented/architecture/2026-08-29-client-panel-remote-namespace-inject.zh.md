# Agent Note: 客户端面板必须声明所用 Remote 命名空间

Status: implemented

[English](2026-08-29-client-panel-remote-namespace-inject.md) | 中文

## Problem

网关客户端把每个 Remote 命名空间安装为可追踪的 `remote.<namespace>` 服务，而不是经 JavaScript Proxy 暴露。读取 `ctx.remote.<namespace>` 因此要经上下文 reflector 解析，调用方必须在自身 `inject` 里声明 `remote.<namespace>`。设置壳和 General 面板声明了自己的；Subagents、Skills、System prompts 三个面板只声明了 `remote`，却直接读 `ctx.remote.settings` / `ctx.remote.skills` / `ctx.remote.llm` / `ctx.remote.systemPrompt`，于是数据调用一跑，页面就报 `cannot get property "remote.settings" without inject`。

## Decision

各面板声明自己读取的每个命名空间：`ui-settings-subagents` 增补 `remote.settings`，`ui-settings-skills` 增补 `remote.skills`，`ui-settings-system-prompts` 增补 `remote.settings`、`remote.llm`、`remote.systemPrompt`。各自的 spec 固定完整 inject 列表，并提供声明所要求的命名空间桩。

## Consequences

这份声明从此双向承重：面板读了未声明的命名空间，失败的是自己的 spec fixture 而不是出厂页面；网关客户端也得以保持命名空间服务的可追踪性，而不必退回放宽契约的 Proxy。给客户端面板新增 Remote 读取时，现在必须同步补 inject 条目——与 Host 侧对普通服务的既有规则一致。

## Alternatives considered

**让网关客户端退回命名空间 Proxy。** 否决：可追踪服务正是为了在命名空间缺席时页面可见地失败（认证时代的命名空间不再普遍存在），Proxy 会把它掩盖成运行时 undefined。

**由设置壳统一注入全部命名空间再下发。** 否决：这会重新制造 inject 列表本要暴露的隐藏依赖，且壳无法知道某个 section 的实现读了哪些命名空间。
