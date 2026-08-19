# Agent Note: Host 拥有的 Automation 开火

Status: implemented

[English](2026-08-15-host-owned-automation-runs.md) | 中文

## 问题

用户需要一条可配置规则：到墙上时钟时刻时 **打开新 Session** 并提交固定任务。仅限会话内的 Schedule 会回到原来的 live 对话，原 Session 变冷时不做任何事，并且明确拒绝全局调度器。goal、jobs、workflow 和 headless 一次性运行也都不满足：它们挂在已有 Agent 上、随进程内 job 消失、需要 parent Agent，或跑完一次就退出。

第二个需求是内部开放接口：Settings、Host RPC 和后续模型 tool 必须共享同一条变更路径。自然语言是模型的工作；harness 不得解析「每个工作日九点」。

## 决策

`ctx.automation` 在 `automation` storage domain 里拥有 Host 级规则表。存活的 Web Host 从 enabled 规则武装定时器，开火时创建 `origin: 'automation'` 的 Session，固定可选 permission preset，追加仅日志的 `automation/start`，并把 task 作为插件来源的 user message 入队。

选择器是 `after`、`at`、`every`（≥ 300 秒，只取最近一次）和 `local-clock`（`HH:mm` 加可选 ISO 星期与显式 IANA 时区）。没有 Cron 求值器。`onOverlap` 是逐条规则的 `skip` | `replace`，只看该规则上一次 `started` Session：忙表示 live Agent 且 `status === 'running'`。`skip` 记录 `skipped_busy`；`replace` 用 `{ kind: 'automation', ruleId }` 取消并立即打开新 Session。

tool、Host RPC 和 Web 侧栏面板是同一服务的 Consumer。本记录交付服务、持久表、origin/cancel-cause 扩展、模型 tool、Host RPC 和包测试。[Web Automation 侧栏](2026-08-15-web-automation-sidebar.md) 在该接口上占据 New Session 下方的 `sidebar.automation`。

## 考虑过的替代方案

**扩展 `dsh-schedule`。** Schedule 的持久权威是原 Session 日志，投递模式是 `session-local`。把 Host 范围的新会话规则折进那条流，会混进两种身份，并复活 Schedule 已经拒绝的全局调度器。

**把规则存进 `settings.yaml`。** Settings 命名空间保存标量用户偏好。带 branded id、选择器和 run 历史的集合是 storage domain。

**在 harness 里解析自然语言。** time-context 已经把请求本地时区告诉模型。再做一个解析器会重复这份工作，并发明一种日历语言。

**`replace` 时等待 `whenIdle()`。** 产品要求立即启动新 Session。cancel 停止当前 turn 并清空 inbox；下游工具可能仍在收尾。

## 验证

包测试覆盖选择器校验、`after` 规则的创建/开火、`skip` 与 `replace` 互斥、idle 不算忙、permission 固定、删除不复用 id、`deleteRun`、`runNow` 不移动下一目标、live timer owner、domain/table 不变式，以及 tool 权威。Session 测试接受 `origin: 'automation'`，并拒绝其他 origin 字面量。

## 后果

开火 Session 以 `origin: 'automation'` 出现在普通列表里。停止的 Host 不会开火。周期追赶只取最近一次。模型 tool 拒绝不在 live root Agent、且该 turn 开场消息不是 `{ kind: 'user' }` 的 mutate 调用，避免开火 Session 再创建规则。
