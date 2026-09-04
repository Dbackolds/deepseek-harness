# Agent Note: 桌面 Host 不得打开系统浏览器

Status: implemented

[English](2026-09-04-desktop-web-host-no-open.md) | 中文

## 问题

自 `d66841ea3f`（"open the ready Web UI by default"，2026-08-14）起，裸跑 `dsh web` 会在启动后把 readiness URL 交给系统默认浏览器打开（`packages/bundle/web-app`：`openBrowser` 默认 `true`，仅在 SSH 会话下自动禁用）。这个默认值对 CLI 面是对的，但 `apps/desktop` 启动的正是同一个 `dsh web` Host 且从未传过 `--no-open`，于是桌面每次启动都会把 loopback UI 打开两份：一份在 Electron 窗口里，另一份是用户默认浏览器里多出的标签页——2026-08-14 以来的每个版本、每次启动都如此。

## 决策

`webHostArgs`（`apps/desktop/src/host.ts`）现在给它构造的每条命令都追加 `--no-open`，转发参数里已带该 flag 时去重合并。桌面窗口是 Web UI 的唯一呈现面；把 readiness URL 交给系统浏览器在任何桌面场景下都不成立，因此该 flag 无条件生效，而不是做成 `DSH_DESKTOP_WEB_ARGS` 的可选项。

## 备选方案

- **给 `DSH_DESKTOP_WEB_ARGS` 配一个桌面侧默认值。** 避免改动代码路径，但每个不知道该环境变量的用户都会继续踩到坏行为；而这个错误行为在桌面场景没有需要保留的合法用途。
- **在 `web-app` 内部检测 Electron 启动并禁用 `openBrowser`。** 需要跨 bundle 边界新增桌面探测契约；桌面壳本来就拥有自己的 Host argv，窗口需要什么、不需要什么，由它声明最自然。

## 影响

桌面启动不再打开浏览器标签页。桌面启动日志里的 `dsh web: opening the default browser; pass --no-open to disable` 一行随之消失。想让标签页回来的用户无法从桌面壳得到它；直接运行 `dsh web` 仍保留其自身默认行为。

## 测试

`apps/desktop/tests/host.spec.ts` 在原有端口复用断言之外，钉住每条 `webHostArgs` 产物都含 `--no-open`（覆盖显式 `--port` 路径与转发参数已含该 flag 的情形）。
