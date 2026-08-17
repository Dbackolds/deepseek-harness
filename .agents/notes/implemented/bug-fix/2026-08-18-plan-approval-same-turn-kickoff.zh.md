# Agent Note: Approved plan review continues the same turn

Status: implemented

[English](2026-08-18-plan-approval-same-turn-kickoff.md) | 中文

## Problem

批准 `exit_plan_mode` 时已经会离开 plan mode 并返回成功的工具结果，因此 agent loop（智能体循环）会打开同一轮次的下一步骤。下一次请求不再携带 `plan:policy`，而仅存的用户文本仍是最初的规划任务。模型因此把规划工作当成已经完成，回复后等待另一条用户消息，而不是执行已批准的计划。

已交付的 plan-policy 段落和工具描述都把实现说成“在批准后的后续步骤才开始”，这与循环行为一致，但不符合 Approve 表示立即开工的产品预期。

## Decision

经批准的评审仍会记录静默的待生效退出，并让 `plan:policy` 覆盖当前工具批次的剩余部分。同一次成功还会调用 `exec.deferContext()`，附上一条 `{ kind: 'plugin', plugin: 'plan-mode', form: 'notice' }` 开工上下文，要求本轮次的下一次请求立即执行已批准计划、遵守对话里已有的批准后指示，并且不要等待另一条用户消息。

工具结果文本与已交付的 `plan:policy` 段落使用同一表述：Approve 会离开 plan mode，并由同一轮次的下一步骤实现该计划。继续规划、放弃审阅以及其余每一种失败评审都不会附带开工上下文。

这延续了 [plan-mode 协作状态](../simplification/2026-07-22-plan-specific-collaboration-state.md) 的经评审退出约定；它在 `plan:policy` 被移除后补上缺失的立即执行上下文。

## Verification

`dsh-plan-mode` 包测试钉死经批准的结果文本、推迟开工上下文的来源与措辞，以及继续规划时不附带该上下文。循环集成测试通过真实的 `exit_plan_mode` 评审驱动 agent loop，并断言第二次请求省略 `plan:policy`、包含开工上下文，且在没有另一次用户后续输入的情况下产出脚本化的实现回复。

## Alternatives considered

- **只依赖既有工具结果句子** — 否决：批准后，规划任务的用户消息仍主导该请求，而结果文本中的“从你的下一步骤开始”仍会被读成以后再做，而不是本轮次。
- **steer 一条合成的用户“开始实现”消息** — 否决：它看起来会像一条新的人类提示词；若当前轮次已经停止，还会唤醒后续轮次，并把宿主证明与插件上下文混在一起。
- **把 `plan:policy` 保留到批准后的第一次请求结束** — 否决：模式翻转已经是规划结束的持久事实；残留的规划段落会继续禁止已批准计划所需的变更。

## Consequences

Approve 现在会在同一轮次开始实现，无需第二条用户提示。代价是每次经批准的评审都会多一条插件来源上下文，并在 transcript（文本记录）中显示为 `plan-mode` 通知。模型仍可能忽略这条开工指令；该变更只是把义务写清楚，而不是强制执行。
