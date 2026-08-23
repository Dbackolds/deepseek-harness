# Agent Note: StarPivot 容器镜像

Status: implemented

[English](2026-08-23-starpivot-container-image.md) | 中文

## Problem

本 fork 的 Host 定制只存在于 `StarPivotNet/deepseek-harness`。官方 npm 安装或任何第三方 dsh 镜像都会启动上游树，并丢掉市场、session-control、自动化和消息编辑。仓库也没有容器发布序列，因此每日上游合并可能只刷新源码，而不重建可运行镜像。

CLI 拒绝 `--host 0.0.0.0`，因此只转发该 flag 的容器无法绑定所有网卡。

## Decision

StarPivot 容器镜像是第五条发布序列，与 npm `dsh`、vendor、Landlock 和 desktop 分开。

[docker/Dockerfile](../../../../docker/Dockerfile) 对本 checkout 做两阶段构建：`pnpm install --frozen-lockfile`、`pnpm run build`，然后把 `pnpm --filter @deepseek-ai/dsh deploy --legacy --prod` 写进 `/opt/dsh`。运行时镜像不以官方或第三方 dsh 镜像为起点。`.dockerignore` 排除 `.git`，因此 `pnpm run build` 无法 `git rev-parse HEAD`。Dockerfile 要求 build-arg `DSH_CLIENT_COMMIT_HASH`；`Release (docker)` 传入 `github.sha`。deploy 之后，[scripts/docker/restore-vendored-host.ts](../../../../scripts/docker/restore-vendored-host.ts) 把被省略的 vendored 包（`cosmokit`、`schemastery`、`cordis-plugin-group` 以及其他 Cordis vendor 行）拷进 Host 的 `node_modules`，因为工作区 `link:` override 和生产态 peer 省略会让这些 import 无法解析。

[docker/webserver.cordis.yml](../../../../docker/webserver.cordis.yml) 是启动器 `--patch`，它把 `webserver` 行配置替换为 `host: 0.0.0.0`，并保留 `port: !!js ctx.webStartup.port ?? 3080`。入口是 `dsh web --patch /etc/dsh/webserver.cordis.yml --no-open`；`--port` 仍是应用参数。

`Release (docker)`（`.github/workflows/release-docker.yml`）在 `desktop-v*` 和 `docker-v*` 标签上，以及 `publish=true` 的手动触发时，发布 `ghcr.io/starpivotnet/deepseek-harness`。标签是 `sha-<12>`、desktop 包版本、git 标签名和 `latest`。该 job 在结束前会拉取版本标签并运行 `dsh --version`。

## Alternatives considered

**在镜像里发布 `npx @deepseek-ai/dsh`。** 不予采纳，因为那是官方树，缺少本 fork 的 Host 行。

**`FROM` 第三方 dsh 镜像再叠补丁。** 不予采纳，因为基础镜像已经没有这些定制，一层补丁也无法从缺失源码重建市场、session-control 或自动化。

**把 `--host 0.0.0.0` 当作应用 flag。** 不予采纳，因为 `web-startup` 把该值当作用法错误。用 `--patch` 替换 `webserver` 行配置才是受支持的绑定覆盖。

**第六条从不共享 `desktop-v*` 的 `docker-v*` 序列。** 不作为默认路径采纳。desktop 和容器都交付本 checkout 的 Host；共享 `desktop-v*` 保持同一条版本线。需要只重建容器时，仍可使用 `docker-v*`。

**把 `.git` 拷进构建上下文，好让 `git rev-parse HEAD` 可用。** 不予采纳：上下文会带上镜像不需要的历史。客户端构建已经接受 `DSH_CLIENT_COMMIT_HASH`，它就是源码提交。

**只靠 `pnpm deploy --legacy --prod` 作为 Host 闭包。** 不予采纳：工作区 `link:` override 会省略 cosmokit/schemastery，Cordis 插件 peer（如 group）也不在 CLI 生产图上。部署树在把它们拷回去之前无法 import。

## Consequences

desktop 或 docker 标签会从本 checkout 重建 GHCR。StarPivot 部署不再使用官方 npm 和第三方镜像。

代价：

- **镜像体积。** 运行时内嵌 `@deepseek-ai/dsh` 的 `pnpm deploy`。
- **构建时间。** 每次发布都在 `ubuntu-24.04` 上跑完整工作区安装和构建。
- **GHCR 可见性。** 包在 `StarPivotNet` 下；首次拉取需要 `docker login ghcr.io`。
- **本序列没有多架构矩阵。** 发布镜像是 Ubuntu runner 的架构。

## Testing

`scripts/docker/image.spec.ts` 固定 overlay 绑定主机、启动器 `--patch` / 应用 `--port` 拆分、Dockerfile 对本 checkout 的 deploy、必需的 `DSH_CLIENT_COMMIT_HASH` build-arg、vendored Host 补齐、GHCR 名称，以及工作流标签触发。`scripts/docker/restore-vendored-host.spec.ts` 把被省略的 vendor 包拷进假的 deploy 树。`Release (docker)` 是实际执行的构建与发布路径。
