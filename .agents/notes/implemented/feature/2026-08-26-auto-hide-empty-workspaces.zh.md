# Agent Note: 自动隐藏空工作区

Status: implemented

[English](2026-08-26-auto-hide-empty-workspaces.md) | 中文

## Problem

归档项目 Workspace 中最后一条可见 Session 后，侧边栏会留下空的分组行。[隐藏 Workspace](2026-08-20-workspace-hide.zh.md) 是持久化清理，但会把该登记移入已隐藏，并且需要显示才能恢复。只想在归档后缩短分组列表的用户，会把已隐藏区堆满，或者在想起显示之前丢失该 Workspace。

## Decision

视图选项增加第四组 **空工作区**，互斥行为 **自动隐藏** 和 **始终显示**。默认是始终显示。该偏好写在现有持久化键 `dsh.workspace.view.v8` 的 `emptyWorkspaces: 'show' | 'hide'`；缺少该字段视为始终显示，因为再水合会整份替换 JSON 值。

自动隐藏会在现有可见性过滤之后（已归档、空白和 subagent 行不可见）当 `sessionCount === 0` 时从分组主列表省略项目 Workspace。它从不调用 `workspace.hide`，从不写入 `hiddenWorkspaceIds`，也从不把这些行放进已隐藏。Chat / No Repo 始终保留。拥有 `list.current` 的 Workspace 始终保留，包括空白的新会话。之后再出现可见 Session 时，该行按 Host `workspaceIds` 顺序回来，因为登记从未被移除。

这是浏览器本地的呈现过滤。隐藏 Workspace 仍是把 Workspace 折入已隐藏的 Host 持久集合。

`deriveGroups` 接受可选的 `emptyWorkspaces`（默认始终显示）。`SessionTree` 传入 store 值，并从同一份过滤后的 `groups` 列表推导 Workspace 拖拽邻接，因此被省略的行不是放置目标。单列表、选择器、搜索、Host 隐藏／显示和置顶不变。

## Alternatives considered

**在最后一次归档时调用 Host 隐藏。** 否决：每个被清空的 Workspace 都会进入已隐藏，使该分区变乱，并且恢复需要显示工作区，而不是视图选项。

**默认开启自动隐藏。** 否决：升级后已有的空项目行会消失，用户已经看到的分组列表会突然变短。

**提升持久化键版本。** 否决：新键会丢掉置顶和顺序；把缺失的 `emptyWorkspaces` 字段当作始终显示，可保留现有 v8 存储。

## Consequences

- 自动隐藏缩短分组主列表且不调用 Host 隐藏；始终显示立即恢复空的项目行。
- 即使为空，聊天和当前 Session 所属 Workspace 仍保持可见。
- 已隐藏、选择器占用、New Session 目标选择和置顶 id 不变。
- 其他标签页仅在共享同一 origin 的 localStorage 时共用该偏好。

## Testing

树测试覆盖自动隐藏省略空的以及仅含已归档成员的项目分组、保留空的聊天、保留当前空白会话所属 Workspace、Host 隐藏的分组仍进入已隐藏，以及默认／未定义表现为始终显示。Store 测试覆盖默认 `'show'`、`setEmptyWorkspaces('hide')`，以及缺少该字段的 v8 存储不读成 `'hide'`。浏览器测试覆盖第四组菜单、默认始终显示勾选、自动隐藏去掉空项目行且不调用 `hideWorkspace`、始终显示将其恢复、聊天仍在，以及当前空白新会话所属 Workspace 仍在。
