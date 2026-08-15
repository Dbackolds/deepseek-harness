# Agent Note: 桌面端 Finder 启动的 Node 解析

Status: implemented

[English](2026-08-15-desktop-gui-node-resolution.md) | 中文

## 问题

`resolveNodeExecutable` 兜底返回裸命令 `node`。经 Finder 或 `open` 启动的 Electron 进程继承的是精简的 GUI `PATH`（`/usr/bin:/bin:/usr/sbin:/sbin`），其中没有 Node，于是拉起 `dsh web` 报 `spawn node ENOENT`，除非此前某次启动已把 Node 路径写入启动记忆。

## 决策

在 pinned、记忆路径与 `npm_node_execpath` 之后，`resolveNodeExecutable` 依次探测绝对路径（`/usr/local/bin/node`、`/opt/homebrew/bin/node`、`~/.volta/bin/node`、`~/.asdf/shims/node`），最后才退回 PATH 上的 `node`。探测到的绝对路径用于 spawn，并经现有的 `host.child.spawnfile` 持久化进入启动记忆。

## 后果

终端启动行为不变（`npm_node_execpath` 优先）。Node 装在常见 Homebrew/Volta/asdf 位置的机器上，首次 Finder 启动即可拉起 Host；冷门位置仍需一次成功的终端启动或设置 `DSH_NODE_EXEC` 来播种记忆。

## 测试

`apps/desktop/tests/host.spec.ts` 继续覆盖 `resolveNodeExecutable`；候选列表依赖宿主文件系统，探测路径由重建后的 `open` 启动验证（本机选中 `/usr/local/bin/node`）。
