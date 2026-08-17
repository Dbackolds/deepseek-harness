# @deepseek-ai/dsh-client-ui-git-branch

[English](README.md) | 中文

新会话屏幕上的 Git 分支芯片。它填充工作区选择器和 agent 预设芯片旁边的 `conversation.hero.branch`，列出工作区仓库，并通过 `git.describe`／`git.checkout`／`git.createBranch` 切换当前会话的 overlay。

工作区检出目录仍是 Session 成员关系键。检出任何其他分支都会在 `$DSH_HOME/worktrees/<workspace-id>/<session-id>` 下创建或复用一个关联 worktree，并记录一条 `git/worktree` 事件。因此两个会话可以停在不同分支上而不互相挪动。不是 Git 仓库的工作区会隐藏该芯片。

当前会话变化时芯片会重新加载，因此每个对话保留它上次选择的分支。新建分支会打开一个小对话框，然后只为当前会话检出这个新名字。远程跟踪行列出时保留远程前缀。工作区处于 detached 检出时，芯片显示唯一匹配的引用，或多个引用指向同一提交时显示短 commit。

## 模型体验

无，因为选择器是浏览器 chrome；宿主 worktree overlay 拥有所有面向模型的 cwd 效果。

#### KV Cache effect

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **没有脏树合并** —— 离开一个有未提交改动的隔离 worktree 会强制移除该树；未提交工作必须先提交或 stash。
- **没有远程推送或拉取** —— 芯片只列出并检出本地或已经 fetch 过的远程跟踪名。
