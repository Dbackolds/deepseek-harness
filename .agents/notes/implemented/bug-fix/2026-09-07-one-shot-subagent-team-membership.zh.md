# Agent Note: 一次性 subagent 不是隐式 Team Lead

Status: implemented

[English](2026-09-07-one-shot-subagent-team-membership.md) | 中文

## 问题

Team Lead 可以启动普通一次性 subagent，包括终端 Bugbot reviewer。该 child 是带 `parentSession` 的直接 Session，且不在 Team roster 上。`tryMembership` 把不在 roster 上的直接 child 当成嵌套 Lead，除非 suffix 中已经有 `subagent/descriptor`。

一次性 in-process provider 在第一次 prompt assembly 之后、于 `agent/pre-step` 内追加该 descriptor。因此 `agent/created` 与那次首次 assembly 看到的是 origin 为 `subagent`、尚无 descriptor 的 child。scoped Team 工具会装到这个错误 Lead 上，随后的 `team:policy` assembly 抛出 `TEAM_NOT_MEMBER`，中止该 child 的轮次。

## 决策

由 provider 管理的 subagent 不是 Team member。`tryMembership` 在发布时按 `SessionHeader.origin === 'subagent'` 分类。suffix 中的 `subagent/descriptor` 仍作为省略 origin 的日志回退。普通 host fork 仍会成为独立 root，因为它们不是由 provider 管理。已入册 teammate 仍通过持久 `team/member` 记录成为成员。

[Agent Teams 身份决策](../feature/2026-08-05-agent-teams.zh.md) 仍负责隐式 root Team 与 roster。本注记只负责 origin 早于 descriptor 的分类。

## 备选方案

**等到 descriptor 存在后再分类 child。** 不予采用：第一次 prompt assembly 已经需要正确的成员关系，而一次性 provider 只在该 assembly 之后才写入 descriptor。

**把每个带存活 parent 的 Agent 都当成嵌套 Lead。** 不予采用：这正是失败的分类。由 provider 管理的 child 与 teammate 共享 parent Session，但不得继承 Team 工具。

**把一次性 descriptor 的追加移到未发布的 setup。** 不予采用：一次性 provider 约定在 child 的初始 turn 内追加 descriptor。成员关系可以使用发布时已经存在的 header origin。

## 影响

普通一次性 child 保持默认目录，并在 Team Lead 下完成其轮次。teammate 仍会收到 scoped Team 工具。没有存活 parent 的已恢复、由 provider 管理的 child 仍不会被分类为 Team root。

## 测试

roster 测试覆盖带 origin 且尚无 descriptor 的存活一次性 child，以及没有 origin、仅有 descriptor 的 child。工具测试覆盖 `agent/created` 与首次 assembly：一次性 child 上不会出现 Team 工具和 `team:policy`。
