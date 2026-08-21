# Agent Note: 冷启动改挂成员投影

Status: implemented

[English](2026-08-21-cold-rehome-membership-projection.md) | 中文

## Problem

`session.rehome` 追加 `workspace/home` 并移动工作区账本，但不改写 `SessionHeader.cwd`。活动 attach 已经按该 overlay 校验，因此重启前会话会留在目标工作区。启动却只用出生 cwd 重建成员索引，把已记账 id 从目标工作区滤掉，侧栏把它显示在聊天（无项目收容桶；Host 仍称 Ungrouped）。

[会话改挂提案](../../proposed/feature/2026-08-20-session-rehome.zh.md) 曾把冷会话显示为 Ungrouped 记为可接受。Web 分组不能接受：改挂后的对话不必打开，也必须留在当前工作区，而不是聊天。

## Decision

工作区成员家是最后一条 `workspace/home`，否则为 `SessionHeader.cwd`。`git/worktree` 仍是同仓库 overlay，不改变成员关系。

首次引导仍只按 header cwd 分组，不 inspect 事件正文。已初始化标记写入后，已记账会话按成员家投影：活动日志优先，否则非变更性 `inspect` 提供 overlay。不调用 `load`。inspect 只针对已在工作区账本中的 id。单个 inspect 失败时回退到 header cwd，不中止注册表启动。后续没有 overlay 事件的 header 查找会保留已索引的 overlay 家，而不是用出生 cwd 覆盖。

冷 attach 使用同一成员家，因此持久化的 `workspace/home` 可以挂到 overlay 工作区，而不发布该会话。Host `session.rehome` 的无操作判断用成员家，而不是工具 cwd，因此即使 `git/worktree` overlay 碰巧等于目标，仍会追加 `workspace/home`。

## Alternatives considered

**改挂时改写 `SessionHeader.cwd`。** 否决：出生 cwd 是持久化身份和 JSONL 位置键。

**把 `git/worktree` 当作成员移动。** 否决：该 overlay 只在当前项目内隔离分支；侧栏分组必须留在工作区。

**启动时 inspect 每个持久化会话。** 否决：仅能通过 cwd 识别的会话在引导后仍属 Ungrouped，扫描未入账日志只会增加 I/O，不改变分组。

**保持冷 Ungrouped，直到会话被打开。** 否决：Web 分组要求重启不得把已改挂对话洒进聊天。

## Consequences

已记账的改挂会话在 Host 重启后仍留在 overlay 工作区。聊天仍收容无项目账本或家路径不匹配的会话。首次历史引导分组不变。

## Testing

`packages/workspace/workspace/tests/workspace.spec.ts` 覆盖冷 attach 到 `workspace/home` overlay、重启后投影到 overlay 工作区、`git/worktree` 不移动成员关系、overlay 不匹配时过滤兄弟会话且不中止启动，以及后续 archive/attach 查找不得用出生 cwd 改写 overlay 家。`packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` 覆盖活动改挂，以及 `git/worktree` overlay 已等于目标时仍写入 `workspace/home`。
