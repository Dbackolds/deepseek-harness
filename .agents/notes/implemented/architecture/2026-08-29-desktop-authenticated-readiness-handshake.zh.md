# Agent Note: 桌面端认证就绪握手

Status: implemented

[English](2026-08-29-desktop-authenticated-readiness-handshake.md) | 中文

## Problem

`fix(web): authenticate the browser Host API`（`3e24087bfa`）改变了桌面窗口依赖的三个事实。就绪行现在打印带认证的 URL（`dsh web: http://127.0.0.1:<port>/?token=…`）；启动图以 `globalThis["__DSH_BOOT__"]` 注入，而非 `window.__DSH_BOOT__`；索引对有效根 token 回应 303 并铸造 `dsh-auth-*` 会话 cookie。桌面端仍只在 URL 以端口结尾时匹配就绪行，仍探测已废弃的单插件 URL `/plugins/@deepseek-ai/dsh-client-modules/client.js`，仍在等待 `window.__DSH_BOOT__` 标记。打包窗口因此永远无法完成就绪握手，并在 60 秒监督预算到期时杀掉自己健康的 Host：`desktop-v0.1.2-alpha.1.1` 归档内的打包 Host 能启动，窗口却只显示失败页。

## Decision

桌面端按 Host 当前的契约工作，共享契约由桌面侧的 spec fixture 钉住。

`parseReadyLine` 接受回环 origin 之后可选的 path 与 query，并把完整 URL（含 token）保留在 `ReadyUrl.href`。窗口加载该 URL，由 Chromium 完成 token 换 cookie 的交换；导航围栏从它推导 origin。

废弃的 `/plugins` 探针已移除。认证改动之后，组合启动图与提供插件 bundle 是同一个 Loader 行，因此 manifest 等待就是就绪门。`waitForBootManifest` 先执行一次握手——303 表示取 `set-cookie` 键值对，401 表示 token 被拒并立即失败而非耗尽预算——随后带该 cookie 轮询索引直到标记出现。不含 token 的就绪 URL 直接轮询索引，checkout 启动与打包启动共用一条路径。Host 输出先解析再回显，因为 GUI 启动的进程可能持有停滞的 stdout，握手不能等回显。

spec fixture 现已覆盖带 token 的就绪行（含与不含 LAN 交接两种）、`globalThis` 标记形态、握手及其 cookie 复用，以及 401 立即拒绝。

## Consequences

桌面端从此双向依赖已认证的 Host 契约：不含 token 的就绪 URL 保留旧的未认证索引轮询，含 token 的 URL 必须走 303 握手，因此 Host 若再改变任一形态，失败的是桌面 spec fixture 而不是出厂窗口。插件路由探针的移除删除了单插件 bundle URL 的最后一个读取方；若组合逻辑日后把图注入与 bundle 服务拆开，manifest 等待必须补一个等价的第二道门。被拒 token 现在立即导致启动失败，因此错填的 token 覆盖项表现为失败页，而非六十秒白屏等待。

## Alternatives considered

**改为探测组合后的 bundle URL。** 否决：combo bundle URL 携带每次启动的 revision，桌面端必须先从它还读不到的索引里刮取 URL，探针只会复述 manifest 等待。

**就绪行一打印就加载窗口。** 否决：传输层就绪不代表应用就绪，这正是 postmortem 0003 记录的误报。
