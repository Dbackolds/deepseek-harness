# Agent Note: 收起轨道隐藏注入入口的文字标签

Status: implemented

[English](2026-08-31-collapsed-rail-hides-injected-entry-labels.md) | 中文

## Problem

第三方 New Session 兄弟入口（例如 `dsh-mnemon`）会注入带图标 span 和文字标签的按钮。56px 轨道上，外壳已经把该按钮收到 36px 并设 `overflow: hidden`。这些插件只在 `[data-dsh-frame][data-sidebar-collapsed]` 下隐藏标签，而布局框架从未发布 `data-dsh-frame`。残留标题会被裁成单字记号——中文「记忆系统」露出的就是「目」。

## Decision

`AppFrame` 在三栏根节点上始终设置空的 `data-dsh-frame`，并在显示紧凑轨道时保留 `data-sidebar-collapsed`。注入的兄弟入口可以把这一对属性当作公开的收起钩子，而不必读取侧栏的哈希 class。

侧栏外壳同时在轨道上隐藏已知注入标签（`span:last-child` 与 `[class*="entryLabel"]`），并把它们的 SVG 收到与 New Session、添加、搜索相同的 18px 图形，这样即使插件仍未匹配框架属性，标题文字也不会裁进图标盒。

## Alternatives considered

**只改已安装的 `dsh-mnemon` 包。** 不予采纳：Host 会升级该插件，且 SSH / taskboard 入口共用同一套注入模式。

**只依赖现有的 last-child `display: none` 规则。** 不予采纳：插件自己的 `[data-dsh-frame]` 规则从未匹配；如果注入再多节点，按 class 隐藏标签比按子元素下标更稳。

**让插件去读哈希后的 `.collapsed`。** 不予采纳：CSS module 哈希不是跨包约定。

## Consequences

- `dsh-mnemon` 0.2.x 的收起 CSS 无需重打包即可隐藏「记忆系统」/ "Memory system"。
- 已知注入兄弟入口的轨道图形为 18px，与官方 36px 控件一致。
- 布局测试固定 `data-dsh-frame`；侧栏样式测试固定轨道标签隐藏与图形尺寸。
