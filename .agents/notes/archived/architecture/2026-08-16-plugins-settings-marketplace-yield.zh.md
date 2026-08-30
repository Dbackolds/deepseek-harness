# Agent Note: 随附的插件设置行向随安装内置市场让位

Status: implemented
Archived: 2026-08-30

[English](2026-08-16-plugins-settings-marketplace-yield.md) | 中文

## Problem

随安装内置市场（`@deepseek-ai/dsh-client-ui-settings-plugin-marketplace`）会覆盖随附的插件设置页：它提供 `pluginMarketplaceUi`，并以默认 priority 注册 `settings.section` 的 id `plugins`。随附的 `dsh-client-ui-settings-plugins` 行使用相同 id 与相同 priority，因此同时组合两者会让浏览器 Loader 因单元格重复而失败，GUI 停在启动失败页。

## Decision

随附的插件导航行以 `priority: 1` 注册。以 priority `0` 占用同一单元格的市场是 shadow 胜出者（最低 priority 负责渲染），不会冲突。随附插件还会监听市场 Loader 条目名 `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace`（`fiber.entry.options.name`，不是 `runtime.name`——双面客户端模块导出的是 `{ apply, inject }`，`runtime.name` 为空）的 `internal/plugin`，在该 fiber 的 `apply` 运行之前拆掉导航行和 `configurable` 标签页，因为市场会声明 `settings.plugin.item`。三张宿主平面卡片仍会在市场页上线后注入该 item slot。

`dsh-app-boot` 也导出市场 Host 半侧会导入的 profile 变更 helper（`packageExportsBundle`、`reconcileProfilePlugins`、`runProfilePnpm`、`readProfilePatches`、`writeProfilePatches`），profile 启动通过 `provideProfile` 发布 `ctx.profile`。这些 helper 改的就是 `dsh plugin` 改的那批文件。

web profile 会把市场 Host 行挂为 `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host`、把浏览器行挂为包入口，以及 [`dsh-host-plugin-catalog`](../../../packages/host/plugin-catalog/README.md)；后者在 `/plugin-catalog/catalog.json` 提供随附的 StarPivot 清单。发现页的默认目录 URL 就是这条路径。

## Alternatives considered

- **匹配 `runtime.name`**：浏览器 Loader 把原始模块命名空间交给 `ctx.plugin()`，除非包导出 `name`，否则 `runtime.name` 为空。包 id 在 Loader 条目上。
- **在 `internal/service` 上注销随附行**：LOADING fiber 期间的 `provide` 要等到该 fiber 变为 ACTIVE 才会通知，而那时市场已经注册了该单元格。
- **让市场以非零 priority 注册**：该包交付时不带 `priority` 字段；随附行必须把默认单元格留空。
- **由市场 patch 禁用随附的 `ui-settings-plugins` Host 行**：那样也会丢掉三张宿主平面卡片，以及这些卡片注册进去的标签栏。
- **继续让发现页走公开 GitHub raw URL**：已拒绝，因为目录现在是随安装内置的 Host 路由；随附清单不再需要拉取 `StarPivotNet/dsh-plugin-catalog`。

## Consequences

- 组合随安装内置市场不再只因为两个包都命名插件导航行而导致浏览器启动失败。
- 既不提供 `pluginMarketplaceUi`、也不以 priority `0` 注册的市场，如果仍以 priority `1` 复用 id `plugins`，仍会冲突。
- 市场占用该页期间，随附的 `configurable` 标签页保持关闭；若该页声明了 `settings.plugin.item`，三张卡片仍会出现。
- Host 在线时发现页不必访问 GitHub；额外的 http(s) 目录 URL 仍由运营者拥有。
