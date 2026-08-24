# Agent Note: 桌面端复用上次 Host origin 以保留浏览器本地 GUI 状态

Status: implemented

[English](2026-08-24-desktop-reuses-host-origin-for-localstorage.md) | 中文

## 问题

置顶会话写在 workspace 浏览器的 persist 键 `dsh.workspace.view.v8` 里。Chromium 按加载 origin 隔离该存储。桌面端每次启动都跑 `dsh web --port 0`，重启就会绑到新的 loopback 端口，Chromium 把它当成新 origin，置顶区变空，而会话本身仍留在各自 Workspace 分组里。

## 决策

Electron userData 的 `workspace.json` 在 cwd 和 Node 之外再记下上次成功的 Host 端口。`startWebHost` 复用前先探测 `127.0.0.1:<port>`。记住的端口空闲时使用 `--port <n>`；被占用或不存在时使用 `--port 0`。转发 web 参数里的显式 `--port` 仍然优先。Host 打印就绪 URL 后把该端口写回，供下次启动复用同一 origin。

置顶 Session id 仍是浏览器本地状态。桌面端靠保持 origin 来保留它们，而不是把置顶搬到 Host settings。

## 考虑过的替代方案

**把置顶 id 迁到 Host settings。** 此次缺陷不予采用：分组、展开和 Session 顺序已经共用同一 persist 键。只改置顶，换 origin 时视图 store 其余部分照样丢失，而且 Host settings 是另一套持久化与 schema。

**给 Chromium 自定义 `session.partition`，让 localStorage 忽略 HTTP origin。** 不予采用：Electron 在 persist partition 内仍按 origin 划分网站存储。没有稳定 origin 的自定义 partition 恢复不了该 store。

**始终绑定固定端口，例如 3080。** 不予采用：checkout 与打包桌面端可能和默认 3080 的 `dsh web` 同时运行。端口冲突会让窗口启动失败，而不是回退。

## 后果

正常重启桌面端会再次打开 `http://127.0.0.1:<上次端口>`，并恢复置顶、分组和展开。若该端口已被占用，窗口仍会在操作系统分配的端口上打开，该 origin 的浏览器本地 GUI 状态从空开始。转发 `--port` 仍把 origin 钉在操作者指定的端口上。

## 测试

- `apps/desktop/tests/host.spec.ts` 固定记住端口的 argv、拒绝不可复用端口，并对占用后释放的 loopback socket 检查 `listenPortAvailable`。
- `packages/client/ui-workspace/tests/tree.client.spec.ts` 从 `dsh.workspace.view.v8` 再水合 `pinnedSessionIds`。
- `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx` 从 `pinnedSessionIds` 在 Workspace 分组上方渲染置顶标题。
