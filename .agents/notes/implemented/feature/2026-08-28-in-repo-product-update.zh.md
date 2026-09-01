# Agent Note: In-repo product update

Status: implemented

[English](2026-08-28-in-repo-product-update.md) | 中文

## Problem

打包后的桌面端和 CLI 用户没有应用内信号提示存在更新的 GitHub Release。桌面打包把自动更新推迟了。用户必须自己去 GitHub 查看。

## Decision

`@deepseek-ai/dsh-client-ui-update` 是双面客户端插件。Host 侧每 24 小时轮询 GitHub Releases（ETag / body-hash，最近一次成功结果缓存在 `product-update` settings namespace），与 `readProductVersion()` 比较，并在 Host Connection RPC 注册表上提供 `/product-update`。浏览器侧渲染通用设置行和叠加层 toast。该插件从不下载或安装。

比较版本优先使用 `DSH_PRODUCT_VERSION`，否则使用已发布 CLI 包，再否则使用本包自身的 package.json。桌面端启动时写入 `DSH_PRODUCT_CHANNEL=desktop`，并从 Electron `app.getVersion()` 写入 `DSH_PRODUCT_VERSION`。标签前缀为 `dsh-v*` 与 `desktop-v*`。默认源是 CLI/Web 的 `deepseek-ai/deepseek-harness` 与桌面端的 `StarPivotNet/deepseek-harness`；显式 `repo` 配置仍然优先。持久化的发行 URL 和 `window.open` 只接受 `https://github.com/...`。

Host fiber 持有 24 小时 interval，在 dispose 时清除，并中止进行中的 fetch。浏览器侧从 Host settings 缓存注水；**立即检查** 是唯一由客户端发起的轮询。Slot 冲突由 slot 核心失败。invariant 伴生插件为空：settings 命名空间校验并发布持久缓存，Host、checker 与客户端行为测试覆盖 check/dismiss RPC 以及叠加层 toast。

## Alternatives considered

**electron-updater / 应用内安装器。** 不予采纳：产物未签名、额外更新面，且打包说明已推迟签名。GitHub URL 足够。

**浏览器侧轮询。** 不予采纳：GitHub 速率限制、CORS，且 Host 已经持有 settings 持久化。

## Consequences

- 设置 → 通用显示当前版本、最新标签和立即检查。
- 存在更新且未被忽略的标签时出现叠加层 toast。
- 桌面端和 CLI 共用一个插件；通道由环境变量选择。
- 没有安装器、没有签名、没有私有源。

## Testing

Checker、semver、releases 和 RPC 单元测试固定解析、比较、缓存和忽略。Host fiber 测试固定 interval、RPC 和 dispose。客户端 apply 测试固定 slot 注册以及检查/忽略。桌面端 `webHostEnv` 把通道和版本合并进 Host 子进程。
