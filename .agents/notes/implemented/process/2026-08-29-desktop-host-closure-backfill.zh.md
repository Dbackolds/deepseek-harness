# Agent Note: 桌面 Host workspace 闭包回填

Status: implemented

[English](2026-08-29-desktop-host-closure-backfill.md) | 中文

## Problem

`pnpm --filter @deepseek-ai/dsh deploy --legacy --prod` 把打包 Host 修剪到 CLI 的 npm 依赖图，但运行中的 Host 解析的比这多：只以 `peerDependencies` 出现在已部署包里的 Service Definition 与提供者、bundle `cordis.patch.yml` 里的插件行（例如 `dsh-base` 组合了 `dsh-llm-default-policy` 却不依赖它）、以及 `dsh.client.inject` 列表。`desktop-v0.1.2-alpha.1.1` 归档因此一启动就全量插件导入失败——启动或懒组合时共缺 32 个 workspace 包（`dsh-jobs`、`dsh-credentials`、`dsh-workflow`、`dsh-llm-default-policy`……），最后一批要到会话挂载 PTC 预设时才暴露。

## Decision

`scripts/desktop/backfill-host-closure.ts` 在 `stageHost` 中紧随 `restoreVendoredHostPackages` 运行。它计算部署树的引用集——每个已部署包的 `dependencies` 与 `peerDependencies`、其 `dsh.client.inject` 列表、以及已部署 `@deepseek-ai` 包下每个 `cordis.patch.yml` / `agent.cordis.yml` 的插件行（用共享的 `loadCordisYaml` 解析，`!!js` 表达式得以保留）——并把缺失的 `@deepseek-ai/*` 名字从构建好的 workspace 拷入，重复直到某轮零拷贝（被拷入的包自身可能再引用另一个被省略的包）。拷贝保持 deploy 形态：`lib/`、`package.json`、preset 与资源目录，绝不含 `src/`、`tests/`、tsconfig/tsdown 文件。引用了却没有构建 `lib/` 的包会让打包大声失败。

spec fixture 覆盖名字索引、specifier 到包名的归约（子路径、裸 id、绝对路径）、引用扫描（peer、带引号与子路径的组合行、`!!js` 配置）、传递闭包、目录形态，以及对已完整树零拷贝的一轮。

## Consequences

全新的 `desktop-v*` 归档从此无需手工补丁即可启动并组合每个预设；闭包的代价是每次打包多一次有界扫描和几 MB 拷贝。回填刻意不做语义判断——它拷贝每个被引用的 workspace 包，而不是决定哪些引用"要紧"，因此不会漏填，但仅被部署永不激活的组合行引用的包也会进包。移除它的前提是 deploy 自身携带完整引用闭包（或各 bundle 把每个被组合的插件声明为依赖）；在那之前，Host 归档契约隐含这一步。

## Alternatives considered

**把每个被组合的插件声明为 `dsh-base` 依赖。** 否决作为唯一修法：它只覆盖一个 bundle 的行，盖不住 peer 的 peer 和其他 bundle 的组合，且每新增一行组合都多一次忘记改清单的机会。

**调整 `--config.auto-install-peers`。** 经实测否决：打包已经传了 `auto-install-peers=true`，本地用完全相同的 deploy 命令复现，同样缺这 32 个包。
