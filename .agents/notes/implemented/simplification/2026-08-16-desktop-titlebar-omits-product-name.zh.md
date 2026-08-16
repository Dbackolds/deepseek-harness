# Agent Note: 桌面标题栏不绘制产品名

Status: implemented

[English](2026-08-16-desktop-titlebar-omits-product-name.md) | 中文

## 问题

无边框桌面壳会在预留标题栏里、系统窗口按钮旁绘制 `DeepSeek Harness`。Web GUI 自己的页头已经标出产品名，这条注入标签只是在第二层窗口装饰里重复同一身份，并不提供窗口控制信息。

## 决策

`titlebarMarkup` 仍保留拖拽区和平台内边距，不再绘制产品名标签。Electron 窗口标题、Dock 名称、启动页 `document.title` 以及开始菜单快捷方式仍使用 `DeepSeek Harness`，以便操作系统切换器与安装入口保持可识别名称。

## 曾考虑的替代方案

**把该标签留作标题栏唯一内容。** 不予采用：它只是复述 Web 页头，并挤占红绿灯 / 系统标题按钮条。

**改成会话或工作区标题。** 不予采用：这些值已由 Web GUI 持有；桌面包不拥有会话状态。

## 后果

预留条只剩空白拖拽区和系统控件。若要重新在标题栏放文案，需要一份取代本注记的新产品决策。

## 测试

- `apps/desktop/tests/titlebar.spec.ts` 断言两个平台的 markup 都保留拖拽区，且不含 `DeepSeek Harness`。
