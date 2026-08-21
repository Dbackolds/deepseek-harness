# Agent Note: 市场 Host 行拥有 RPC 通道

Status: implemented

[English](2026-08-19-marketplace-host-row-owns-rpc.md) | 中文

## 问题

web 组合包为内置市场挂了两行 Loader：Host 的 `plugin-marketplace` 和浏览器的 `ui-settings-plugin-marketplace`。两行都指向 `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace`，而该包入口再导出 Host `apply`。因此第二行会再次注册 `/plugin-marketplace`。`dsh web` 先打印就绪 URL，随后插件树以 `webserver: duplicate prefix route "/plugin-marketplace"` 失败。桌面端把这当成崩溃循环并停止重新挂载。

## 决策

`plugin-marketplace` 导入 `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host`。包入口是空的 Host `apply`，供浏览器行使用，与其他双面设置插件一致。`/plugin-marketplace` 和斜杠命令留在 Host 行。

## 考虑过的替代方案

**只保留一行 Loader。** 不予采用：`dsh.client` 发现仍需要一条 Host 可见的浏览器行，模块节点半侧才能提供 `./client`。

**让 Host `apply` 在第二次注册时幂等。** 不予采用：重复的 `(kind, path)` 是 webserver 上的组合错误。两行都拥有 RPC 通道仍会把第二个 Host 半侧藏起来。

## 后果

已经打出 `lib/index.js` 的检出在没有这次拆分前仍会失败。Host 行说明符是已发布导出；把旧包入口名复制到 `plugin-marketplace` 的 overlay 仍会冲突。web 组合包名册保留两行：`plugin-marketplace` 指向 `./host`，`ui-settings-plugin-marketplace` 指向包入口。浏览器行不是第二个 RPC 所有者。删掉它之后，设置 → 插件会停在普通配置卡片上，因为 `pluginMarketplaceUi` 从未挂载。

## 测试

- `packages/client/ui-settings-plugin-marketplace/tests/host/entry-split.client.spec.ts` 要求 Host 行命名 `./host`，且包入口保持为空。
- `packages/client/ui-settings-plugin-marketplace/tests/invariant.client.spec.ts` 把 Host 身份留在 `./host`。
