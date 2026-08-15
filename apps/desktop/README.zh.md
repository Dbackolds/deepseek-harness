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

窗口在 Electron 进程起来后立刻启动 `dsh web --port 0`，让 Host 启动与 Chromium ready 重叠。HTTP 服务器一打印 `dsh web: http://127.0.0.1:<port>` 就加载该 loopback URL；后续 Host 行继续挂载，浏览器 boot 内核自己等待客户端插件。关闭窗口会停止 Host。Windows 用系统标题栏按钮处理最小化、最大化和关闭。任务栏和窗口图标与 Web favicon 使用同一只 DeepSeek 鲸鱼标。Windows 上首次启动会在开始菜单写入带该图标和 AppUserModelID 的 `DeepSeek Harness.lnk`；请固定这个快捷方式，不要固定裸的 `electron.exe` 进程。

## Known Limitations and Deferred Work

- 没有安装包、自动更新、托盘或多窗口。v1 只提供 `pnpm desktop` / `dsh desktop`。
