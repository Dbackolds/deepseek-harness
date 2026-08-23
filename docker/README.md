# StarPivot container image

English | [中文](README.zh.md)

This checkout publishes `ghcr.io/starpivotnet/deepseek-harness`. The image is a `pnpm deploy` of `@deepseek-ai/dsh` from this tree, not an official npm install and not a third-party dsh image. Official bytes omit this repository's Host customizations: marketplace, session-control, automation, message edit, and the other StarPivot rows.

## Run

```sh
DSH_CLIENT_COMMIT_HASH=$(git rev-parse HEAD) docker compose -f docker/compose.yml up --build
```

The process listens on `0.0.0.0:3080` inside the container. Publish host port 3080. Mount the workspace at `/workspace` and persist `$DSH_HOME` at `/var/lib/dsh`.

The CLI rejects `--host 0.0.0.0`. [webserver.cordis.yml](webserver.cordis.yml) is a launcher `--patch` that replaces the `webserver` row config so the bind host is `0.0.0.0` while `--port` still wins through `webStartup`.

Pull a published tag:

```sh
docker pull ghcr.io/starpivotnet/deepseek-harness:latest
docker run --rm -p 3080:3080 -v "$PWD:/workspace" ghcr.io/starpivotnet/deepseek-harness:latest
```

## Publish

`Release (docker)` (`.github/workflows/release-docker.yml`) builds [Dockerfile](Dockerfile) and pushes GHCR tags. A `desktop-v*` or `docker-v*` tag, or a manual dispatch with `publish=true`, publishes `sha-<12>`, `<desktop version>`, the git tag name, and `latest`. The job passes `github.sha` as `DSH_CLIENT_COMMIT_HASH` because `.dockerignore` excludes `.git`. After deploy it restores omitted vendored packages so `dsh --version` can resolve cosmokit and the Cordis plugin peers. The job pulls the version tag and runs `dsh --version` before it finishes.

Do not start this image from `npx @deepseek-ai/dsh` or another registry's dsh image. Rebuild from this checkout whenever master or a desktop release moves.
