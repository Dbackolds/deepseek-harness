# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

包裹本地 `dsh web` Host 的 Electron 窗口。聊天界面仍是官方 Web GUI；本包只负责窗口、Host 进程和标题栏。

## 运行

在仓库根目录完成 `pnpm run build` 后：

```sh
pnpm desktop
```

或：

```sh
pnpm dsh desktop
```

窗口在 Electron 进程一存在时就启动 `dsh web --port 0`，让 Host 启动与 Chromium 就绪重叠。HTTP 服务器一打印 `dsh web: http://127.0.0.1:<port>` 就加载该 loopback URL；后续 Host 行在浏览器引导内核等待客户端插件期间继续挂载。关闭窗口会停止 Host。Windows 使用系统标题按钮 overlay 完成最小化、最大化和关闭。任务栏与窗口图标是与 Web favicon 相同的 DeepSeek 鲸鱼标识。Windows 首次启动会把带该图标与 AppUserModelID 的 `DeepSeek Harness.lnk` 写入开始菜单；请固定该快捷方式，而不是裸的 `electron.exe` 进程。

macOS 上窗口使用 `titleBarStyle: hiddenInset`：原生红绿灯按钮位于标题栏左侧预留区域，标准应用菜单（Edit、Window 各 role 及 Quit）提供常规 Cmd 快捷键。关闭窗口后进程保留在 dock；点击 dock 图标会重新打开窗口并重启 Host。

## Known Limitations and Deferred Work

- 没有安装包、自动更新、托盘或多窗口。v1 只提供 `pnpm desktop` / `dsh desktop`。
