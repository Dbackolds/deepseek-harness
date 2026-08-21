# Agent Note: macOS dock 已完成角标与跳动

Status: implemented

[English](2026-08-20-sidebar-completed-badge-and-dock-bounce.md) | 中文

## Problem

侧边栏已经为完成的 Session 保留浏览器本地 Completed 提醒。后台 macOS 窗口看不到还有多少条提醒未读，新完成的 Session 也不会让 dock 图标动作，因此完成的工作容易被错过。

## Decision

`ui-sidebar` 读取 `useSessions` 列表行上已有的 `completed` 位，并在该计数变化时调用 `window.dshDesktop.setCompletedUnread(count)`。数字是当前列表里仍带有该提醒的 Session 数。浏览器标签页没有 preload，调用为空操作。页内字标保持无角标。

`apps/desktop` 把这条 IPC 合成到打包的鲸鱼 PNG 右上角绿色数字圆标上，再 `app.dock.setIcon`。计数为 0 时恢复未标记鲸鱼。达到 100 时显示为 `99+`。计数上升时还会调用 `app.dock.bounce('informational')`。应用处于前台时 Electron 返回 `-1`，因此已聚焦窗口不会跳动。其他平台忽略该 IPC。

提醒生命周期仍由 `SessionManager` 持有：running→idle 边沿点亮，焦点离开该 Session 后清除，新的一轮运行会解除。

## Alternatives considered

**把计数画在页内字标鲸鱼上。** 否决：请求针对的是 macOS dock 图标，窗口在后台时它仍可见。

**用 `app.dock.setBadge` 显示计数。** 否决：该 API 画的是系统文字角标，不是鲸鱼上的绿色数字圆标。

**加载时对已有 Completed 行都让 dock 跳动。** 否决：刷新会为操作者已经看到的提醒跳动。只有相对上次发布值上升时才让 dock 跳动。

## Consequences

外壳现在只为转发计数读取 `useSessions`。Workspace 分组、行状态点和已完成分区仍在 `ui-workspace`。浏览器标签页不会给 dock 加角标。macOS 跳动是 informational（约一秒）。

## Testing

侧边栏组件测试通过 preload 发布计数、不在页内绘制数字，以及该调用抛错时仍保留外壳。辅助函数规格覆盖计数函数和 preload 空操作路径。桌面规格在 RGBA 缓冲上叠绿色圆标、对打包鲸鱼 PNG 做往返、计数为 0 时恢复未标记图标、仅在计数上升时跳动，并断言 preload 与主进程接线。
