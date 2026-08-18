# Agent Note: 桌面端 Finder 启动的 Node 解析

Status: implemented

[English](2026-08-15-desktop-gui-node-resolution.md) | 中文

## Problem

`resolveNodeExecutable` 兜底返回裸命令 `node`。经 Finder 或 `open` 启动的 Electron 进程继承的是精简的 GUI `PATH`（`/usr/bin:/bin:/usr/sbin:/sbin`），其中没有 Node，于是拉起 `dsh web` 报 `spawn node ENOENT`，除非此前某次启动已把 Node 路径写入启动记忆。

## Decision

在 pinned 的 `DSH_NODE_EXEC` 之后，打包 Host 的内置 Node（`host/node` 或 `host/node.exe`）优先于记住的系统 Node，这样发布升级不会继续使用上一次 checkout 的二进制。checkout 启动随后探测 `npm_node_execpath` 和绝对路径（`/usr/local/bin/node`、`/opt/homebrew/bin/node`、`~/.volta/bin/node`、`~/.asdf/shims/node`），最后才退回 PATH 上的 `node`。选中的绝对路径用于 spawn，并经现有的 `host.child.spawnfile` 持久化进入启动记忆。

## Alternatives considered

**让记住的系统 Node 排在打包二进制前面。** 不予采纳，因为安装包已经自带 Node 后，升级仍会拉起上一次 checkout 或 Homebrew 的 Node。

**把 Node 打进 Electron asar。** 不予采纳，因为 Electron 的 `process.execPath` 不能运行 CLI，而且 Host 是作为 extraResources 暂存在应用旁边。

## Consequences

打包启动使用内置 Node，不查阅 GUI `PATH`。checkout 终端启动仍优先 `npm_node_execpath`。Node 装在常见 Homebrew/Volta/asdf 位置的机器上，首次 Finder 启动 checkout 即可拉起 Host；冷门位置仍需一次成功的终端启动或设置 `DSH_NODE_EXEC` 来播种记忆。

## Testing

`apps/desktop/tests/host.spec.ts` 继续覆盖 `resolveNodeExecutable`；候选列表依赖宿主文件系统，探测路径由重建后的 `open` 启动验证（本机选中 `/usr/local/bin/node`）。
