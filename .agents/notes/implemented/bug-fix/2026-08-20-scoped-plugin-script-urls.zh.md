# Agent Note: 带 scope 的客户端插件脚本 URL

Status: implemented

[English](2026-08-20-scoped-plugin-script-urls.md) | 中文

## 问题

每个 web `dsh.client` 包都是带 scope 的 npm 名。modules 的 node 半把它写进 `window.__DSH_BOOT__`，成为 `/plugins/@scope/name/client.js?rev=…`。classic `<script src>` 把路径中的 `@` 视为非法，Chromium 因此不会向 Host 发请求，加载页报告 `bundle script … failed to load`。桌面启动把 Host 绑定与后续 `/plugins` 注册重叠，即使该 URL 合法，第一批脚本仍可能 404。

## 决策

`graphRow` 对包名的每一路径段做百分号编码（`@deepseek-ai` → `%40deepseek-ai`）。`/plugins` handler 在查表前仍对请求 pathname 做 `decodeURIComponent`，因此编码与未编码查找落到同一行。桌面在 Host 打印 loopback URL 之后，等待对 `/plugins/%40deepseek-ai/dsh-client-modules/client.js` 的 GET；浏览器 loader 在后续 Host 行仍在挂载时，会重试首次扫描的脚本未命中。

## 备选方案

**保持 `@` 不编码，依赖 Chromium 去拉取。** 否决：Electron 的 Chromium 在任何 Host 请求之前就拒绝该 URL，重试和就绪探测都无法恢复。

**用无 scope 别名供给插件。** 否决：图 id 就是包名；再引入一个标识会把启动行、脚本 URL 和 factory handoff 拆开。

**用 HEAD 探测。** 否决：`/plugins` 只响应 GET。HEAD 探测会永远 405，窗口停在加载页。

## 影响

带 scope 的插件脚本成为合法 URL。桌面仍把 Host 绑定与后续行重叠，但在一个已编码的客户端 bundle 对 GET 给出响应之前，不会加载 GUI。市场插件 node 半缺少 `lib/index.js` 时，Host 仍会在 profile 加载失败；那是源码构建缺失，不是这次 URL 编码。

## 测试

`packages/client/modules/tests/node-half.client.spec.ts` 断言编码后的图 URL，以及对这条编码路径的 GET。`apps/desktop/tests/host.spec.ts` 断言桌面探测使用编码后的 modules bundle 路径和 GET。`packages/client/modules/tests/loader.client.spec.ts` 会重试首次扫描的脚本未命中。
