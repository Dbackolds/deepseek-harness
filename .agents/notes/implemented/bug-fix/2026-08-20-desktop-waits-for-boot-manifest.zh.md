# Agent Note: 桌面端在 loadURL 前等待 boot 清单

Status: implemented

[English](2026-08-20-desktop-waits-for-boot-manifest.md) | 中文

## 问题

桌面窗口把 `dsh web: http://127.0.0.1:<port>` 当作可以 `loadURL` 的信号。这行在 HTTP 服务器能拼出 loopback URL 时就会打印。modules 行更晚才注入 `window.__DSH_BOOT__`。这个空隙里加载页面，会让引导内核对着没有 boot 图的 HTML 跑。`parseBootManifest` 在 `createRoot` 之前抛错，`#root` 保持为空，窗口刷成白屏。modules 行挂上后再刷新同一 origin，GUI 才会出现。

## 决策

`AppWebEntry.run` 先挂载 `AppRoot`。缺失或畸形的 boot 图留在该页并报告解析错误。`startWebHost` 仍等待就绪行，然后轮询 `/`，直到响应体包含 `window.__DSH_BOOT__`，窗口才加载该 origin。

## 考虑过的替代方案

**继续在就绪行加载，只画失败页。** 不能作为唯一修复：首次加载错过清单时，操作者会停在错误页，直到手动刷新。

**把就绪行挪到 modules 行之后。** 不予采用：监督进程和测试已经把这行当作「HTTP 服务器已在听」。改它的含义会卡住只需要端口的等待方。

## 后果

桌面启动页会覆盖 modules 行尚未注入的空隙。始终不注入该图的 Host 会以 `timed out waiting for window.__DSH_BOOT__` 超时，而不是留下白窗口。

## 测试

- `packages/client/web/tests/boot-manifest.client.spec.tsx` 在没有 `__DSH_BOOT__` 时挂载 `AppWebEntry`，并期望失败报告。
- `packages/client/web/tests/app-root.client.spec.tsx` 仍在同一页绘制缺失清单的文案。
- `apps/desktop/tests/ready.spec.ts` 接受已携带该图的 index，并拒绝裸 shell。
