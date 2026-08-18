# Agent Note: 客户端插件默认改为手动重载

Status: implemented

[English](2026-08-15-client-plugin-manual-reload.md) | 中文

## 问题

在同时运行 `pnpm run dev:web` 时保存客户端插件源文件，会立即替换该插件 fiber。插件内 React 状态丢失，失败的替换也不会回滚，因而会打断进行中的 Web 会话。Web profile 已经关闭 Host 插件 HMR（热模块替换）；剩下的崩溃路径是始终开启的客户端插件 rebuilt 广播。

## 决策

`client-hmr.autoReload` 是一项由 Host 持久化的布尔值，默认为 `false`。node 半仍会 stat-poll 并重新哈希 bundle，以便随后的手动重载看到当前字节。自动 SSE（Server-Sent Events）`rebuilt` 帧保持关闭，直到该设置为 true。`POST /plugins/reload` 会重新哈希每一行监视，并广播 `reload` 帧；浏览器半始终对这些帧执行替换。

同一插件持有通用设置行：开关写入 `autoReload`，「重载插件」对该手动端点发送 POST。API 代理把 `client-hmr` namespace 与其他 Web 偏好一并列入 allowlist。远程浏览器与所有仅回环 settings namespace 一样，只停留在进程本地。

## 曾考虑的替代方案

**直接禁用 `client-hmr` 行，直到用户再把它 patch 回来。** 否决，因为这也会去掉轮询、SSE 通道和之后的手动替换。接收端保持挂载；只关闭自动广播。

**保留自动重载，只加一个重载按钮。** 否决，因为报告的故障是编辑中途的意外替换，而不是缺少按钮。

**斜杠命令或面向模型的工具。** 否决，因为这是 GUI 上的操作员动作，不是模型应触发的能力，而且 Web 没有 TUI 的 `/reload`。

**连 stat poll 一并关掉。** 否决，因为之后的手动重载会从陈旧基线哈希，从而漏掉自动热重载关闭期间落地的写入。

## 后果

同时运行 `pnpm run dev:web` 的检出目录，在保存时不再替换正在运行的客户端插件。开发者只在需要该循环时打开「自动热重载」，或在一组完整编辑后按「重载插件」。模型可见的 Web 更新约定同时点名该设置项和 watcher。

## 测试

Host 与 node 半测试锁定 schema 注册、默认关闭的 rebuilt 广播、由设置驱动的启用，以及 POST `/plugins/reload`。客户端测试锁定通用设置行、policy 采纳和 apply 接线。无密钥 settings 场景断言开关默认关闭，跨重新加载与第二个端口持久化 YAML 字段，并记录组装后的对话框快照。Host 持久化沿用与[通过 Host settings 持久化 Web 用户偏好](../bug-fix/2026-08-06-host-backed-web-preferences.md)相同的 settings scope。
