# Agent Note: 侧边栏已完成角标与 macOS dock 跳动

Status: implemented

[English](2026-08-20-sidebar-completed-badge-and-dock-bounce.md) | 中文

## Problem

侧边栏已经为完成的 Session 保留浏览器本地 Completed 提醒，并在已完成分区显示这些行。标志行里的品牌鲸鱼并不报告还有多少条提醒未读，因此没在看列表的操作者看不到计数。在 macOS 上，新完成的 Session 也不会让 dock 图标动作，后台窗口容易被错过。

## Decision

`ui-sidebar` 读取 `useSessions` 列表行上已有的 `completed` 位，在栏展开时把绿色计数角标画在字标鲸鱼上，收起时画在轨道鱼标上。数字是当前列表里仍带有该提醒的 Session 数；达到 100 时显示为 `99+`。角标是装饰性的；辅助技术通过一段视觉隐藏的 `role="status"` 区域听到计数。

计数上升时，若桌面 Host 注入了 `window.dshDesktop.notifyCompleted`，外壳会调用它。`apps/desktop` 在 darwin 上把它映射为 `app.dock.bounce('informational')`，其他平台忽略。应用处于前台时 Electron 返回 `-1`，因此已聚焦窗口不会跳动。缺少 preload 或 Host 调用抛错都是空操作；页内角标仍然保留。

提醒生命周期仍由 `SessionManager` 持有：running→idle 边沿点亮，焦点离开该 Session 后清除，新的一轮运行会解除。

## Alternatives considered

**只把角标放在已完成分区标题上。** 否决：请求针对的是标志行里的品牌鲸鱼，列表滚动或栏收起时它仍可见。

**加载时对已有 Completed 行都让 dock 跳动。** 否决：刷新会为操作者已经看到的提醒跳动。只有挂载后计数上升才请求 Host。

**用同一条 IPC 在 Windows 任务栏闪烁。** 否决：本次请求是 macOS dock 跳动；其他平台只保留页内角标。

## Consequences

外壳现在会读取 `useSessions`。Workspace 分组、行状态点和已完成分区仍在 `ui-workspace`。浏览器标签页看不到 `window.dshDesktop`，也不会跳动。macOS 跳动是 informational（约一秒），不设置 dock 角标字符串。

## Testing

侧边栏组件测试覆盖字标和收起轨道上的计数、100 折叠为 `99+`、挂载时已有提醒不调用桌面 preload、计数上升时调用它，以及该调用抛错时仍保留角标。slot 快照钉住展开鲸鱼上的中文计数。辅助函数规格覆盖计数与标签，以及 preload 空操作路径。样式测试钉住 success token 填充和轨道悬停隐藏。桌面规格在存在 dock 时做 informational 跳动，并断言 preload 与主进程接线。
