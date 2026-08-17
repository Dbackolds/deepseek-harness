# Agent Note: 随安装内置的插件目录与市场

Status: implemented

[English](2026-08-18-in-box-plugin-catalog-and-marketplace.md) | 中文

## Problem

发现页依赖 `StarPivotNet/dsh-plugin-catalog` 上的公开 GitHub raw URL，市场本身又以 `@starpivot/dsh-plugin-marketplace` 的形式活在树外。因此全新的 web profile 在额外安装该组合包之前没有发现清单；即便安装了，GitHub 不可达时发现页也会失败。

## Decision

web profile 同时交付两半：

- [`dsh-host-plugin-catalog`](../../../packages/host/plugin-catalog/README.md) 在具名 Host 路由 `/plugin-catalog/catalog.json` 上提供已 pin 的 StarPivot `catalog.json`。
- [`dsh-client-ui-settings-plugin-marketplace`](../../../packages/client/ui-settings-plugin-marketplace/README.md) 是原先的公开市场，现在是随安装内置的双面包。它的默认目录 URL 就是这条 Host 路径。Host 半侧仍接受额外的 http(s) 目录 URL。

随附的插件设置行仍通过 [`pluginMarketplaceUi`](../architecture/2026-08-16-plugins-settings-marketplace-yield.md) 向该市场让位。市场占用该页期间，清单标签页保持禁用。

## Alternatives considered

- **市场继续留在树外，只把 `catalog.json` vendor 进来。** 已拒绝，因为全新 web profile 仍要二次安装后才有发现页。
- **默认拉取 GitHub，失败再回退到随附文件。** 已拒绝，因为 Host 已有 webserver；具名路由就是目录源，而不是后备。
- **把目录挂到 SPA 回退上。** 已拒绝，因为未命中会变成 `index.html` 而不是 JSON。

## Consequences

新的 web profile 打开发现页时使用随附清单，不必访问 GitHub。运营者仍可添加远程目录。清单编辑是对 `packages/host/plugin-catalog/catalog.json` 的源码变更。
