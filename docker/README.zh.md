# StarPivot 容器镜像

[English](README.md) | 中文

本 checkout 发布 `ghcr.io/starpivotnet/deepseek-harness`。该镜像是对本树 `@deepseek-ai/dsh` 做 `pnpm deploy` 的结果，不是官方 npm 安装，也不是第三方 dsh 镜像。官方字节不包含本仓库的 Host 定制：市场、session-control、自动化、消息编辑，以及其他 StarPivot 行。

## 运行

```sh
DSH_CLIENT_COMMIT_HASH=$(git rev-parse HEAD) docker compose -f docker/compose.yml up --build
```

进程在容器内监听 `0.0.0.0:3080`。把宿主机 3080 端口发布出去。把工作区挂到 `/workspace`，并把 `$DSH_HOME` 持久化到 `/var/lib/dsh`。

CLI 拒绝 `--host 0.0.0.0`。[webserver.cordis.yml](webserver.cordis.yml) 是启动器 `--patch`，它替换 `webserver` 行配置，把绑定主机设为 `0.0.0.0`，同时 `--port` 仍通过 `webStartup` 生效。

拉取已发布标签：

```sh
docker pull ghcr.io/starpivotnet/deepseek-harness:latest
docker run --rm -p 3080:3080 -v "$PWD:/workspace" ghcr.io/starpivotnet/deepseek-harness:latest
```

## 发布

`Release (docker)`（`.github/workflows/release-docker.yml`）构建 [Dockerfile](Dockerfile) 并推送 GHCR 标签。`desktop-v*` 或 `docker-v*` 标签，或 `publish=true` 的手动触发，会发布 `sha-<12>`、`<desktop 版本>`、git 标签名和 `latest`。该 job 把 `github.sha` 作为 `DSH_CLIENT_COMMIT_HASH` 传入，因为 `.dockerignore` 排除了 `.git`。deploy 之后会补齐被省略的 vendored 包，这样 `dsh --version` 才能解析 cosmokit 和 Cordis 插件 peer。该 job 在结束前会拉取版本标签并运行 `dsh --version`。

不要从 `npx @deepseek-ai/dsh` 或其他仓库的 dsh 镜像启动本镜像。只要 master 或桌面版发布前进，就从本 checkout 重新构建。
