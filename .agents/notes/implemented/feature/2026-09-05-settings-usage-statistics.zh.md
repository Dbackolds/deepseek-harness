# Agent Note: 设置页使用统计

[English](2026-09-05-settings-usage-statistics.md) | 中文

Status: implemented

## 问题

Web 设置壳没有 Host 范围的提供方 token、聊天时长或模型占比视图。会话本地的 `tokenUsage` 与 `sessionStats` 投影已经存在，但它们不回答日历活动、连续天数或跨会话合计。

## 决策

在 `sessionStats` 旁增加 `sessionUsage` 投影单元，增加不激活 Agent 即可检查每个可见会话的 Host `usage.overview` Remote，并增加绘制该快照的设置分区。

日历行在折叠中保持 UTC。Remote 用浏览器 IANA 时区，把每个 UTC 日重基准到包含该 UTC 午夜的本地日。token 合计复用四桶 `tokenUsage` 之和。时长复用已组装消息的模型墙钟时间。连续天数统计任何有记录活动的本地日历日。

该页只显示本地应用用量。个人套餐页不属于本决策。

## 考虑过的替代方案

- **在 Client 聚合 `session.list` 投影提示。** 冷列表行除非已经做过小空白探测，否则会省略 `sessionUsage`，页面会少计。
- **在浏览器扫描原始日志。** 这项工作属于已经恢复冷会话的 Host observation 路径。
- **按日持久化 Host 存储。** 折叠是 O(1) 加上每个有活动 UTC 日一行；通过现有 observation 缓存重放日志已经足够。

## 后果

打开使用统计会观察每个可见会话。大型 Host 在每次挂载或重试时承担该成本。缺失、损坏或其他无法读取的会话贡献空用量，而不是让页面失败。

## 必要验证

- `packages/session/session-stats/tests/usage.spec.ts` 覆盖折叠、UTC 日、步内替换、时区重基准与连续天数。
- `packages/api/session-controller/tests/session-usage.host.spec.ts` 覆盖非法时区、跨会话合计、缺失会话与无法读取的会话。
- `packages/client/ui-settings-usage/tests/` 覆盖格式化、空/错误/重试 UI，以及设置槽注册。
