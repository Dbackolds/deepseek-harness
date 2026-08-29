# @deepseek-ai/dsh-client-ui-update

[English](README.md) | 中文

产品更新的 Host 轮询与浏览器设置行。Host 侧按 24 小时间隔轮询 GitHub Releases，把最近一次成功结果缓存在 `product-update` settings namespace，并通过 loopback RPC 通道提供 `/product-update`。浏览器侧挂载通用设置行和 shell 叠加层 toast。检查从不下载或安装产物；**打开发布页**会打开 GitHub URL。

通道选择默认 `auto`：Electron 窗口启动 `dsh web` 时写入 `DSH_PRODUCT_CHANNEL=desktop`，匹配 `desktop-v*` 标签，否则匹配 `dsh-v*`。比较版本优先使用 `DSH_PRODUCT_VERSION`，否则使用已发布 CLI 包版本，再否则使用本包自身的 package.json。

## 模型体验

无。该插件轮询 GitHub 并渲染浏览器 UI；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **从不下载或安装** — toast 和设置行打开 GitHub Release URL。打包后的桌面端仍没有应用内安装器。
- **仅 GitHub Releases** — 一个公开仓库源；不支持私有源或镜像。
- **陈旧缓存回退** — 轮询失败时保留最近一次成功结果 24 小时，因此 GitHub 中断不会让该行变空。
- **未签名桌面产物** — 首次启动时的 Gatekeeper / SmartScreen 警告仍属于打包问题，不属于本插件。
