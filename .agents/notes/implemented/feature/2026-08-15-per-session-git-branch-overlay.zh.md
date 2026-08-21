# Agent Note: 新会话屏幕上的逐会话 Git 分支 overlay

Status: implemented

[English](2026-08-15-per-session-git-branch-overlay.md) | 中文

## 问题

新会话 composer 已经有工作区芯片和 agent 预设芯片。它们旁边的空位是选择 Git 分支的自然位置，而且他要求每个对话保留自己的分支。`SessionHeader.cwd` 在创建后不能移动：工作区成员关系、持久化项目目录和 attach 校验都键在这条不可变路径上。让两个会话去检出同一个工作区 checkout，也会抢同一个 HEAD。

## 决策

继续把 `SessionHeader.cwd` 当作工作区成员关系键。用一条只进日志的 `git/worktree` 事件记录逐会话 overlay。最后一条事件是工具、`{{cwd}}` 和 `sandboxPolicy.resolve()` 使用的目录；没有这条事件时它们继续使用 header cwd。检出工作区 HEAD 会复用工作区 checkout。任何其他名字都会在 `$DSH_HOME/worktrees/<workspace-id>/<session-id>` 创建或复用一个关联 worktree，因此两个会话可以停在不同分支上。

Web 芯片填充现有 hero 芯片旁边的 `conversation.hero.branch`。它调用 `git.describe`／`git.checkout`／`git.createBranch`。芯片只在当前会话 id 或工作区 id 变化时加载 `git.describe`；同一身份的重叠加载会合并且一个更新的身份会中止更早的 describe。不是 Git 仓库的工作区会隐藏该芯片。选择器列出本地短名，以及带远程前缀的远程跟踪名（`origin/master`）；它不会把远程跟踪名折叠进同名本地头。工作区 HEAD 处于 detached 时快照带 `detached: true`。芯片和当前行标题显示「游离 HEAD」，而不是短对象 id；`currentBranch` 仍保留该 id，供之后检出复用。当前分支行还会显示这个会话 worktree 的未提交路径数，以及在有上游时的未推送提交数。

## 考虑过的替代方案

**切换时改写 `SessionHeader.cwd`。** 不用 worktree 也能隔离工作目录，但工作区 attach 和成员关系要求 header cwd 等于工作区路径，持久化也按该路径键项目目录。移动它会把会话从所属工作区里丢掉。

**就地检出工作区 checkout。** 不需要额外目录，但两个会话不能持有不同分支，而且一轮中途切换会把文件从另一个对话脚下抽走。

**把控件放在会话标题栏而不是 hero 行。** 他标出的空位在新会话屏幕上，就在工作区和预设旁边。第一条消息之后 overlay 仍然生效；芯片留在那一行，因为其他开场前选择已经住在那里。

## 后果

每个会话可以持有不同分支，而不移动工作区成员关系。隔离 worktree 住在 `$DSH_HOME` 下，会话回到工作区 HEAD 时会被强制移除。被丢弃的隔离树里的未提交工作不会合并回去。模型通过 `{{cwd}}` 和沙箱策略上下文看到 overlay 路径，而不是通过新的提示词段落。

## 测试

overlay fold、沙箱策略解析、宿主 `git.*` RPC、隔离 worktree 的创建／检出／返回路径、保留远程前缀的远程跟踪名，以及 detached HEAD 标签，由针对真实 Git 仓库的包测试钉住。`describeSessionGit` 对同一 worktree 路径会复用成功快照，TTL 为 `gitDescribeCacheMs`（默认 500ms；`0` 关闭）；checkout 和 createBranch 会失效该缓存。hero 芯片的加载、仅身份变化时重载、非仓库时隐藏、检出、远程跟踪检出、创建，以及 HMR 安全的 slot 注册路径，由 `ui-git-branch` 客户端测试钉住。
