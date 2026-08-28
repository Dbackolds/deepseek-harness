# Agent Note: Automation 取消等待后恢复调度

Status: implemented

[English](2026-08-29-automation-cancelled-wait-resumes.md) | 中文

## 问题

存活 Host 可以把每条 enabled 规则都显示为 overdue，却仍不打开 Session。`requestDrive()` 会取消当前 `setTimeout`，以便更短的剩余目标、overlap idle 或 CRUD 变更能重新推导。`wait()` 只在该 timeout 或 dispose 时结束，因此进行中的 drive 会停在被取消的等待上。之后的到期时刻到不了 `fireDue`。被拒绝的 `fireDue` 也会结束整段 drive，同一批次的后续到期规则就不会开火。

## 决策

`clearTimer()` 会结束它取消的那次等待。drive 循环随后重读墙钟，要么开火到期规则，要么武装下一次有界等待。被拒绝的 `fireDue` 记日志；该批次的后续到期规则仍会运行。若批次结束后仍有到期目标，owner 等待一分钟再重试。

## 考虑过的替代方案

**保留原 wait Promise，再并排启动第二次 drive。** 不予采用：两次 drive 会在同一规则表上竞态，并可能重复开火。

**像 Schedule 的损坏日志路径那样，在取消等待时让 runtime 永久故障。** 不予采用：取消等待是 CRUD、overlap idle 和成功开火后的普通重新推导路径。永久故障会让 Host Automation 直到重启才恢复。

**被拒绝的开火后推进仍到期的周期目标。** 不予采用：只追赶最近一次已经会跳过错过的间隔；失败时推进会在没有打开 Session 的情况下跳过当前出现时刻。

## 后果

Host 在 CRUD、overlap skip 或打开失败后只要仍存活，就会继续开火后续到期规则。仍到期的目标每分钟最多重试一次。停止的 Host 仍然不做任何事。

## 测试

- `packages/automation/automation/tests/domain.spec.ts` 在 `requestDrive` 取消第一次等待后开火后创建的更早规则，并在更早的 `fireDue` 拒绝后开火后续健康规则。
