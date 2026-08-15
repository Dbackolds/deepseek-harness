# Agent Note: 侧边栏会话活动分区

Status: implemented

[English](2026-08-15-sidebar-session-activity-sections.md) | 中文

## Problem

侧边栏已经用圆点区分已完成未查看、运行中和空闲 Session，但列表本身仍是一份按最近更新或 Workspace 堆在一起的清单。刚完成、仍需回看的工作会和正在运行的会话以及旧历史挤在一起，操作者必须逐行扫描才能找到刚完成或仍在运行的项。

## Decision

`ui-workspace` 把所有可见 Session 列表——Workspace 分组和单列表——按此顺序拆成三个状态分区：**已完成**（`completed` 提醒且没有正在进行的工作）、**运行中**（待处理交互或自身／后代活动）和**历史记录**（其余空闲 Session）。分类是现有行状态位的纯函数；打开 Session 仍通过 `SessionManager` 清除提醒，因此该行会在下一次列表快照中从已完成移到历史记录，而不另建一套已读存储。

已完成和运行中保持全部展开。历史记录沿用 [Workspace 侧边栏顺序与折叠](2026-08-11-workspace-sidebar-order-and-folding.md) 中的五行折叠和临时**展开其余**控件。Session 拖拽只发生在起始分区内；持久化记账顺序仍保存全部 Session，松手只改写同一分区内的邻居。

## Alternatives considered

**用这三个分区替换 Workspace 分组。** 本次请求是给现有列表加状态拆分，不是取消 Workspace 归属、添加／重命名或 Host Session 顺序。

**再加一种视图选项模式。** 需要操作者手动打开的模式会把默认 Workspace 视图里的拆分藏起来，而截图里的正是这份默认列表。

**持久化另一套已读集合。** 绿色提醒在此浏览器里已经表示「已完成且未查看」。再加一份持久已读位会与 `SessionManager.completed` 漂移。

## Consequences

三个分区标题只属于呈现层。搜索仍是一份扁平匹配列表。Workspace 组头、Host 顺序和提醒生命周期保持不变。Session 开始运行会立刻离开已完成；打开 Session 会在下一次列表快照中离开已完成。被崩溃／重载中断的 Session 会标为 interrupted；`session.list` 随后恢复它，并用一条插件通知续上一轮。

## Testing

树测试覆盖三向分类和空分区占位。浏览器测试覆盖单列表分区标题、空闲历史记录超过五行后的折叠，以及现有 Workspace 历史记录折叠文案。
