# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

包裹本地 `dsh web` Host 的 Electron 窗口。聊天界面仍是官方 Web GUI；本包只负责无边框窗口、Host 进程和标题栏。

## 运行

在仓库根目录完成 `pnpm run build` 后：

```sh
pnpm desktop
```

或：

```sh
pnpm dsh desktop
```

窗口会启动 `dsh web --port 0`，等到 `dsh web: http://127.0.0.1:<port>` 后再加载该 loopback URL。关闭窗口会停止 Host。

## Known Limitations and Deferred Work

- 没有安装包、自动更新、托盘或多窗口。v1 只提供 `pnpm desktop` / `dsh desktop`。
