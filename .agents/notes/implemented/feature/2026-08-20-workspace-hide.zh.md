# Agent Note: 隐藏 Workspace

Status: implemented

[English](2026-08-20-workspace-hide.md) | 中文

## 问题

侧边栏清理 Workspace 的唯一操作是删除注册记录。该操作会丢掉持久化的 `sessionIds` 账本，于是该组会话（包括当前会话）立即出现在 Chat 下。想缩短列表的用户因此打散了自己仍拥有的对话。会话归档已经能在不拆账的情况下隐藏行；Workspace 没有对等的显示集合。

## 决策

`workspace.delete` 仍是注册记录删除。`WorkspaceDomainState.hiddenWorkspaceIds` 是覆盖在注册表顺序之上的 Host 持久隐藏 Workspace 集合，模式与归档集合相同：隐藏与显示绝不改写 `workspaceIds` 或 `sessionIds`。Web 分组列表把隐藏的项目 Workspace 移到末尾的「已隐藏」分区；Chat、单列表和置顶区省略这些会话。隐藏不会把 Chat／No Repo 折入已隐藏区（[侧边栏聊天分组](2026-08-21-sidebar-chat-bucket.zh.md)）。显示，或对同一路径再次 `workspace.create`，按原先的持久化序号恢复该组。

产品约定：隐藏工作区是侧边栏主清理操作；删除仍是注销登记，并把会话打散到 Chat。

### 持久化集合

`hiddenWorkspaceIds` 带默认值，字段出现前写入的介质解析为空集合。成员是 `workspaceIds` 的子集。隐藏会追加一个已注册 id；对已隐藏 id 成功且不写入。显示会移除该 id；已显示的已注册 id 成功且不写入；未知 id 为幂等无操作并返回 false。删除已隐藏 Workspace 时，同一串行操作也从该集合去掉该 id。对隐藏记录的同一路径 `create` 会就地显示并返回既有实体（`created: false`）。领域 version 保持 `2`；zod 默认值能与现有介质往返。

### Host 线路

| RPC / 帧 | 行为 |
| --- | --- |
| `workspace.list` | 在 `archivedSessionIds` 旁携带 `hiddenWorkspaceIds` 作为重连基线 |
| `workspace.hide({ workspaceId })` | 加入一个已注册 id；未知 id 为 `workspace-not-found`；应答完整更新后集合 |
| `workspace.show({ workspaceId })` | 移除一个 id；未知 id 为 `workspace-not-found`；已显示的已注册 id 成功且不写入；应答完整集合 |
| `workspace.create({ path })` | 显示该规范路径上已有的隐藏所有者，不铸造新 id，也不改顺序 |
| `host/hidden-workspaces-changed` | 每次持久集合变更后的全快照帧 |

一元 hide/show 在不等待流回显的情况下安装返回集合。在 `workspace.list` 进行中安装的集合会取代该基线携带的集合，规则与归档相同。`ensureWorkspace` / `session.create` 不会取消隐藏；只有显式 `workspace.create` 会。

### 客户端投影

`WorkspaceListState.hiddenWorkspaceIds` 镜像 Host 集合。运行时 `items` 仍是完整 Host 顺序。隐藏不清空当前会话。只要当前会话仍记在该 Workspace 下，composer 芯片就继续使用其标题，即使该 Workspace 已隐藏。选择器只列出不在隐藏集合中的 Workspace。

隐式新建会话／冷启动目标，在显式 id 之后：

1. 当前会话的 Workspace，无论是否隐藏
2. 可见的 No Repo（Chat）
3. 最近的可见 Workspace
4. 新建会话视图／选择器

### 侧边栏

隐藏是 Workspace 行的主操作，提交时不打开 Modal。删除仍是需确认的危险操作，文案仍写明会进入 Chat。已隐藏分区在分组树末尾，默认收起，使用 `retainAccountKeys` 保留的浏览器本地展开键 `__hidden__`。展开该分区会按持久化 `workspaceIds` 顺序列出隐藏 Workspace；再展开其中一个 Workspace 会列出其会话。该行菜单为显示加删除；重命名与文件夹编辑仍只在可见行上。

隐藏 Workspace 中会话的置顶 id 留在浏览器置顶存储里，并从置顶区消失，直到显示该 Workspace。

## 备选方案

**用隐藏替换删除。** 否决：用户仍需要删除注册记录，而 Chat 散落仍是该所有权边界已记录的后果。

**仅浏览器本地隐藏。** 否决：Workspace 顺序、归档和重连已把 Host 存储当作共享真源；按浏览器隐藏会在标签页之间不一致。

**侧边栏「已隐藏」分页。** 否决：仅为次级列表复制搜索、轨道收起和当前会话定位。

**把隐藏会话打散到 Chat。** 否决：这正是隐藏要避免的缺陷。

**隐藏时清空当前会话，与会话归档一致。** 否决：隐藏是列表折叠，不是离开该对话。

## 后果

- 隐藏保留 Workspace 行、顺序条目和 `sessionIds`；这些会话不出现在 Chat、单列表和置顶区。
- 删除仍注销登记，并把剩余会话打散到 Chat；目录和日志保留。
- 已隐藏 Workspace 中的当前会话保持选中；composer 不是无工作区的 inert 状态。
- 已隐藏分区在末尾且默认收起；显示和同一路径 create 恢复原先的持久化序号。
- 选择器省略隐藏 Workspace；搜索可以打开隐藏 Workspace 中的会话，且不显示该 Workspace。
- 隐式新建会话使用当前 Workspace，即使它已隐藏；否则只用可见的 No Repo／最近的可见 Workspace。
- 当前分组在已隐藏区内自动展开，可能在隐藏后立刻展开某一个 Workspace 的会话，以便仍能找到打开中的对话。
- TUI 和其他非 Web 消费方会看到额外的列表字段，本交付中忽略它。
- 自动隐藏空项目 Workspace 是另一套分组列表过滤，不写入本集合（[自动隐藏空工作区](2026-08-26-auto-hide-empty-workspaces.zh.md)）。

## 测试

领域测试固定 hide/show 持久性、未知 id 无操作、已隐藏／已显示不写入、删除去掉隐藏 id、同一路径 create 就地显示、字段出现前介质默认为空，以及重启恢复。Apiproxy 测试固定列表基线、hide/show RPC、`workspace-not-found`、`host/hidden-workspaces-changed`、create 取消隐藏，以及在隐藏状态下删除。连接 fixture 测试固定 hide/show 帧和同一路径取消隐藏。运行时测试固定一元回声、帧、列表基线竞态、隐藏不清空当前会话，以及目标选择矩阵。UI 测试固定已隐藏区派生、Host items 顺序、隐藏无需 Modal、已隐藏行显示加删除、选择器省略，以及单列表／置顶省略。
