# Agent Note: 会话列表接受 automation origin

Status: implemented

[English](2026-08-19-session-list-accepts-automation-origin.md) | 中文

## 问题

`SessionHeader.origin` 与 `SessionSummary.origin` 已包含 Host 定时会话的 `automation`。客户端对 `session.list` 与 `host/session-added` 的 Zod 解析只接受 `subagent`。因此一条 automation 行会使整份列表值失败，工作区浏览器里每个分组都不渲染会话行。

## 决策

`sessionOriginSchema` 是 `sessionSummarySchema` 与 `host/session-added` 共用的 `subagent | automation` 解析。未知标签仍会让该字段失败。包含合法 automation 行的混合列表现在可以通过解析。

## 考虑过的替代方案

**在 Host 上从 automation 行去掉 `origin`。** 不予采用：持久 header 已经携带该标签，导航视图需要用它区分定时会话与普通会话。

**对未知 `origin` 软失败并保留列表其余行。** 不予采用：载体解析是该线上值的类型检查。丢掉一个字段会把 schema 漂移藏到后续消费者读取时才暴露。

## 后果

包含定时会话的语料库会继续显示全部普通会话。未知 origin 仍会让列表解析失败，而不是静默丢掉那一行。

## 测试

- `packages/host/apiproxy/tests/rpc-schemas.spec.ts` 接受摘要与 `host/session-added` 上的 `subagent` 和 `automation`，接受混合的 `session.list` 值，并拒绝 `fork`。
