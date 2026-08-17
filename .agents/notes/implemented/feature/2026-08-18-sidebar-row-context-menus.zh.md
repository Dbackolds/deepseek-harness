# Agent Note: 侧边栏行右键菜单

Status: implemented

[English](2026-08-18-sidebar-row-context-menus.md) | 中文

## Problem

侧边栏历史列表里的 Workspace 行和 Session 行已经通过悬停才出现的行尾省略号提供重命名、分叉、归档、添加文件夹和删除。打开这些操作需要找到一枚平时隐藏的 16px 控件。在行上右键是列表行的惯用手势，但目前没有反应，于是浏览器的页面菜单会盖在历史列表上。

## Decision

在真实 Workspace 行或非空白 Session 行上右键，打开的是行尾省略号已经持有的同一个 `Menu` 实例。条目不变：Workspace 行仍是重命名／添加文件夹／移除文件夹／删除工作区，Session 行仍是重命名／分叉会话／归档会话。portal 列表用 `clientX`/`clientY` 处的零尺寸矩形定位，因此第一帧就画在指针处。点击省略号仍测量触发按钮，丢弃上一次的指针矩形，并保留移出即关。指针定位的菜单一直开到选中、点到外面或按 Escape，因为列表并不挨着省略号包装。菜单打开期间仍抑制悬停卡片。

Ungrouped 分组和空白「新会话」行仍然没有这些操作。它们的右键只调用 `preventDefault`，避免浏览器菜单盖住列表。

## Alternatives considered

**把右键菜单做成树外的侧边栏插件。** 否决：这些动词和对话框已经住在 `ui-workspace`；插件要么重做一遍，要么穿过 slot 约定去改名、分叉、归档和删除。

**给右键菜单另一套与省略号不同的条目。** 否决：同一行两套菜单会拆散同一组动词，并容易漂移。

**没有动词的行继续弹出浏览器原生菜单。** 否决：在 Ungrouped 或空白「新会话」上右键仍会用与该行无关的页面级条目盖住历史列表。

## Consequences

行菜单有两个打开入口、一份条目。指针定位复用已有的 portal `getAnchorRect` 席位；`Menu` 本身不增加右键模式。搜索结果行仍没有行菜单，因此那里的右键仍是浏览器菜单。

## Testing

`rows.client.spec.tsx` 在已知指针位置用右键打开两种行菜单，派发重命名且不切换 Workspace、不打开 Session，保留省略号路径，并断言 Ungrouped 与空白「新会话」行会拦截浏览器菜单且不渲染条目。
