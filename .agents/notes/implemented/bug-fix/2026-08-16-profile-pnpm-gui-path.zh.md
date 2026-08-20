# Agent Note: Profile 在 GUI PATH 之外解析 pnpm

Status: implemented

[English](2026-08-16-profile-pnpm-gui-path.md) | 中文

## 问题

`runProfilePnpm` 以裸名 `pnpm` 启动进程。终端 `PATH` 通常包含 Homebrew、npm-global 或 pnpm 官方主目录，因此 `dsh plugin` 和市场的 `/update` 在终端里可用。Finder 或 `dsh desktop` 启动会继承 macOS 短的 GUI `PATH`（`/usr/bin:/bin:/usr/sbin:/sbin`），其中既没有 `pnpm` 也没有 `node`。市场 `/update` 和应用内安装因此报告找不到 pnpm，即使同一台机器上已经装过。

## 决策

`resolveProfilePnpm` 是 `runProfilePnpm` 使用的唯一查找入口。它先查 `PATH`，再查常见安装目录（`PNPM_HOME`、pnpm 官方主目录、npm-global、Homebrew、Volta、asdf 以及本 Node 所在目录），最后回退到本 Node 旁边的 Corepack。子进程 `PATH` 会包含这些目录，使 `#!/usr/bin/env node` shim 能在继承的 GUI 环境下启动。宿主机没有 pnpm 时，仍返回结构化的 `missingPnpm` 结果。

## 考虑过的替代方案

**让用户把 pnpm 加进 GUI `PATH`。** 不予采用：Finder 和 Electron 不会加载用户的 shell profile，因此同一台机器在终端里能跑 `dsh plugin`，产品 UI 里仍会失败。

**随产品交付固定版本的 pnpm。** 被 [移除 repository 插件](../simplification/2026-08-09-remove-repository-plugin.md) 否决：profile 变更仍是显式的宿主机包管理操作，不再引入捆绑运行时。

**只在市场插件内解析 pnpm。** 不予采用：`dsh plugin`、市场 `/update` 和安装 RPC 都共用 `runProfilePnpm`；第二套查找会分叉。

## 后果

桌面和 Finder 启动在宿主机已有常见位置的 pnpm 时，可以更新 profile 插件。没有 pnpm 的机器仍会明确失败。新增官方安装主目录时，应更新 `profilePnpmSearchDirs`，而不是某个调用方。

## 测试

- `packages/boot/app-boot/tests/profile.spec.ts` 覆盖 PATH 优先、GUI 短 PATH 加上 `~/.npm-global/bin/pnpm`、本 Node 旁的 Corepack、真正缺失，以及对暂存的常见 shim 的真实启动。
