# Agent Note: 侧边栏聊天分组

Status: implemented

[English](2026-08-21-sidebar-chat-bucket.md) | 中文

## Problem

分组侧边栏只列出 Host 的项目 Workspace。未绑定项目的对话要么作为 **No Repo** 出现在项目文件夹中间，要么只在已有散落 Session 时才出现尾部 Ungrouped。因此开始一段对话必须先打开或选中一个 Workspace，最后一个项目文件夹下方的空白区域也没有可点的聊天入口。

## Decision

分组列表末尾始终有一个 **聊天** 分组（`UNGROUPED_KEY`）。产品文案是 **聊天** / **Chat**。Host 的 No Repo workspace 从项目列表、选择器和 Workspace 拖拽中省略，其 Session 与所有不属于项目 Workspace 的 Session 一起放进聊天。

聊天的 ＋ 会展开该分组，并在已注册 No Repo 时把该 id 传给 `startSession`；未注册时不传 id，共享的 New Session 动作仍会落到可见的 No Repo。聊天没有 Workspace 菜单、悬停卡片或 Workspace 拖拽。隐藏工作区不会把聊天折入已隐藏区：已隐藏的 No Repo 仍是聊天的记账，这样不开项目文件夹也能找到聊天。搜索里 No Repo Session 的工作区标签使用聊天文案。

已注册 No Repo 时，聊天内手动排序的 Session 拖拽会写入该 Host 记账；没有 No Repo 时，聊天顺序仍只保存在浏览器本地，与原先 Ungrouped 相同。

## Alternatives considered

**把 No Repo 留在项目行里只改名。** 否决：它仍会夹在项目文件夹中，暴露隐藏／删除／添加文件夹，并可作为 Workspace 拖拽。

**在工作区上方再加一个顶级分区。** 否决：聊天是无项目剩余项，不是并列的分组模式；放在末尾与原先 Ungrouped 位置一致，项目文件夹保持连续。

**直到出现第一条无项目 Session 才显示聊天。** 否决：空白区域没有 ＋，用户仍然不能在没有 Workspace 的情况下开始聊天。

## Consequences

- 分组模式始终在可见项目 Workspace 之后、已隐藏之前渲染聊天，包括自动隐藏空项目 Workspace 时（[自动隐藏空工作区](2026-08-26-auto-hide-empty-workspaces.zh.md)）。
- No Repo 不会作为项目行、选择器项或已隐藏区行出现。
- 聊天的 ＋ 开始无项目会话；空白行在首次获受理的 prompt 之前仍不进入列表。
- 删除项目 Workspace 后，剩余 Session 仍进入聊天。

## Testing

树测试覆盖始终存在的聊天、No Repo 并入、已隐藏 No Repo 仍留在聊天、以及已隐藏区省略 No Repo。浏览器测试覆盖聊天 ＋ 指向 No Repo 或无作用域启动、聊天没有 Workspace 菜单、以及分组模式显示聊天而不是空状态文案。文案键 `group.ungrouped` 和 `delete.desc` 使用聊天产品文案。
