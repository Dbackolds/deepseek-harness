# Agent Note: 按 artifact revision 记忆 workspace 成员家

Status: implemented

[English](2026-09-05-workspace-session-home-memory.md) | 中文

## 问题

0.1.3 上游合入之后，带着真实会话历史的桌面/web Host 要 15–120+ 秒才能就绪（0.1.2-rc.1 约 3 秒），窗口卡在加载页、一个 CPU 核打满。CPU profile 把启动期约 67% 的 CPU 钉在 `dsh-session-persistence-jsonl` 回放上：`WorkspaceRegistry` 启动时的 overlay 重索引会对每个已记账会话做全量日志读取（为了找最后一条 `workspace/home` 事件），而该存储中 325 个 v0/v1 会话的每次读取都会重试一次注定被拒绝的格式迁移（`unknown historical event type "git/worktree"`、`replayState has unexpected member "kind"`），随后抛错、再被吞成 header cwd 回退。拒绝从不落盘，于是每个启动日都为同一批未变化的 artifact 重新支付 解码 + 迁移 + 深快照（`snapshotSessionFormatArtifact` 对整个 artifact 做深拷贝与冻结）——周而复始，没有尽头。

## 决策

`WorkspaceRegistry` 现在把每个已记账会话解析出的成员家记入 workspace 域的 global 状态（`sessionHomes`，按会话 id 键控），连同计算该答案所用的持久化 artifact revision。启动时，命中（revision 相同）直接凭记忆重放，不读日志；未命中则重新 inspect 并改写记忆。被拒绝的 inspect 以它的 header cwd 回退被记忆——拒绝是 artifact 字节的稳定属性，每个启动日重试它纯属浪费。实时会话仍优先于记忆（快照免费且更新鲜），revision 变化会重新 inspect，全量列表中缺席会话的记忆会被清扫，表不会超出存储规模。该状态字段带 zod default，先于它写入的存储解析结果不变（与 `archivedSessionIds`/`hiddenWorkspaceIds` 同一模式）。

## 备选方案

- **在会话存储里持久化迁移拒绝**（日志旁的按 artifact 拒绝标记）。对所有消费者都消除重复拒绝成本，而不只是 workspace 索引，但要在本周期中途给 session-persistence seam 增加一种新的磁盘 artifact 格式；workspace 记忆已经用纯派生数据消除了本次启动的主要成本。
- **尾部窗口扫 `workspace/home` 来跳过全量读取。** 单次启动更便宜，但改变成员语义——最后的 overlay 可能落在任何固定窗口之前——而 revision 键控的记忆已在不改语义的前提下去掉了这份成本。
- **加速迁移本身**（对刚从 `JSON.parse` 出来的值跳过 detach 拷贝）。对一次性迁移值得做，但与本案无关：被拒绝的会话根本到不了迁移产物，每次启动的代价在"重复"而非"单次"。

## 影响

对未变化的会话存储，启动重放只剩头部成本（profile：session 相关 CPU 从 67% 降到约 1% 采样，总忙采样降约 90%）；变更后的第一次启动支付一遍 inspect 以填充记忆。artifact 增长或迁移过的会话重新 inspect 一次并再次被记忆。记忆是派生数据：删除存储文件或读到陈旧值只多付一遍 inspect，从不出错。域状态通过 default 字段扩展而非版本提升（single layout 存储保持精确版本读取），既有 `workspace.json` 存储原样打开。

## 测试

`packages/workspace/workspace/tests/workspace.spec.ts` 新增 `session-home memory` 组：重启凭记忆重放（不再 inspect）、revision 变化重新 inspect 并改写、拒绝回退被记忆且不再重试、会话离开存储后记忆被清扫、实时快照优先于已存记忆。既有状态断言带上新的 default 字段。
