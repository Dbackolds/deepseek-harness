# Agent Note: 侧栏收起在栏滑动结束时落位

Status: implemented

[English](2026-08-30-sidebar-collapse-settle-with-column-slide.md) | 中文

## Problem

实时收起侧栏时手感会顿一下。外壳用 150ms 淡出宽内容后就切到轨道布局，而 AppFrame 的网格轨道仍在剩余一半的 300ms 缓动里。展开时宽内容又以更短的 200ms 淡入重新挂载，会话列表会晚于栏体打开。

## Decision

`SidebarRoot` 会把冻结的宽内容树一直挂到 AppFrame 栏滑动结束（`COLLAPSE_SETTLE_MS = 300`，对齐 `--ds-transition-duration-slow`）。收起开始时仍跑 150ms 透明度淡出；轨道布局与共用的 `rail-in` / `rail-fade-in` 进入动画只在这次落位之后开始。展开时，宽内容（含 workspace browser 镜像的 `.wide` 规则）以 300ms 淡入重新挂载，使打开轨道与内容共用同一时间线。冷启动的收起渲染保持静态；减少动态效果模式仍会禁用两段过渡。

## Alternatives considered

**保留 150ms 落位，只放宽 rail-in 的 fill mode。** 不予采纳：顿挫来自滑动中途卸载与布局切换，不是单独的 animation fill。

**把淡出拉长到 300ms，同时保留提早落位。** 不予采纳：这只会让已经淡出的宽 chrome 继续挂着，马上再被替换，无法去掉滑动中途的切换。

**用 frame 轨道的 `transitionend` 驱动落位。** 此次修复不予采纳：外壳已有按已发布 slow duration 计时的定时器，AppFrame 也在同一 320ms 预算上清除 `data-sidebar-motion`。DOM 事件桥会耦合包边界，却不改变可见时序。

## Consequences

- 收起时不再在栏体仍在移动时切到轨道。
- 展开淡入与栏滑动对齐，不再拖后一拍。
- 样式与外壳测试固定共用轨道动画 fill、300ms 落位边界，以及 README 时序说明。
