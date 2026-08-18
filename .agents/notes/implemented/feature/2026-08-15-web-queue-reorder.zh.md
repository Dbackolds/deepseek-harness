# Agent Note: 通过拖放重排 Web 排队消息

Status: implemented

[English](2026-08-15-web-queue-reorder.md) | 中文

## 问题

排队消息会在当前轮次结束后按 `next-turn` 顺序继续执行。Web 已经能对精确的单次入队项进行编辑、删除或严格 steering，但要改这个顺序只能删除再重打。相邻的上移／下移按钮无法表达任意目标位置；只在客户端重排则会在下一份快照到达前谎报 Host FIFO。

## 决策

`Inbox.move(messageId, beforeMessageId?)` 在当前列表内重定位一个仍待处理的标识。省略锚点会追加到该列表末尾。未知标识或已在目标位置是 no-op，且不写 splice。另一列表中的锚点会抛错。持久事件是一次覆盖受影响窗口的同列表 `agent/inbox/spliced`，观察方从 splice 重建新顺序，而不是从 discarded-then-inserted 配对推断。

`session.updateQueue` 对 `next-turn` 项接受 `{ kind: 'move', beforeItemId? }`。Host 对 next-step 标识和未知 `beforeItemId` 返回 `queue-item-not-found`，并保持两份列表不变。no-op 重排仍应答 `accepted: true`。QueueDock 在普通会话有两条或更多行时启用 HTML5 拖放：把一行拖到另一行的上半或下半，就会对该被拖动的单次入队项发送这次 move。客户端不做乐观重排；下一份 `session/queue` 快照才是可见提交。已寻址 subagent 行保持只读。

## 备选方案

**只提供相邻的上移／下移按钮。** 否决：任意目标位置需要点 N 次，而且会掩盖 Host 的 insert-before 约定。

**先在客户端重排，等下一份快照。** 否决：认领或第二个客户端可能先赢；等待 Host 快照与编辑、删除保持同一竞态。

**整队列替换 RPC。** 否决：现有按项寻址已经能点名该入队项，一次 splice 也已经记录受影响窗口。

**允许把 next-step 项移进 Queue。** 否决：Queue 变更仍只作用于 queued 项；steering 与注入上下文保持各自的投递约定。

## 后果

准入顺序不再只按追加。取消仍保留当前 `next-turn` 顺序，整队列 steer 仍按实时快照顺序逐项执行，因此一次在 flush 前落地的重排会改变哪一项先被插话。混合内容行仍可移动，因为 move 转发的是标识而不是文本。

## 测试

Inbox 测试固定同列表重定位、标识与位置 no-op、跨列表抛错，以及不会发出 discarded 或 inserted 实时通知。Host schema 与 proxy 测试固定 `move` 操作、未知 `beforeItemId`，以及被拒绝的 next-step 标识。QueueDock 测试固定任意位置放下、no-op 放下，以及单行不可拖。无密钥 Web 队列场景会在唤醒 prompt 前，通过组装后的 HTTP/SSE 组合重排两行被保留的排队项，因此持久准入遵循新顺序。

## 相关

逐行编辑、删除和严格 steering 仍由[为待处理排队项提供可寻址的编辑与删除](../../archived/feature/2026-07-29-addressable-queue-operations.md)与[将 Web 已排队消息转为活动轮次的 steering（中途引导）](../feature/2026-07-30-web-queue-steer-action.md)拥有。本笔记只在该寻址之上增加同列表重排。
