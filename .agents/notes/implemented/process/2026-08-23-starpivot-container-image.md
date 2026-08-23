# Agent Note: StarPivot container image

Status: implemented

English | [中文](2026-08-23-starpivot-container-image.zh.md)

## Problem

This fork's Host customizations live only in `StarPivotNet/deepseek-harness`. An official npm install or any third-party dsh image boots the upstream tree and drops marketplace, session-control, automation, and message edit. The repository also had no container sequence, so a daily upstream merge could refresh source without rebuilding a runnable image.

The CLI rejects `--host 0.0.0.0`, so a container that only forwarded that flag would fail to bind all interfaces.

## Decision

The StarPivot container image is a fifth release sequence, independent of npm `dsh`, vendor, Landlock, and desktop.

[docker/Dockerfile](../../../../docker/Dockerfile) is a two-stage build of this checkout: `pnpm install --frozen-lockfile`, `pnpm run build`, then `pnpm --filter @deepseek-ai/dsh deploy --legacy --prod` into `/opt/dsh`. The runtime image does not start from an official or third-party dsh image. `.dockerignore` excludes `.git`, so `pnpm run build` cannot `git rev-parse HEAD`. The Dockerfile requires build-arg `DSH_CLIENT_COMMIT_HASH`; `Release (docker)` passes `github.sha`. After deploy, `node scripts/docker/restore-vendored-host.ts --deployed /out/dsh` copies omitted vendored packages (`cosmokit`, `schemastery`, `cordis-plugin-group`, and the other Cordis vendor rows) into the Host `node_modules`, because workspace `link:` overrides and production-peer omission leave those imports unresolved. The restore is a Node entry, not `pnpm exec tsx`: `pnpm exec` after `--prod` deploy reinstalls the root production graph and the leftover postinstall cannot find `lefthook`.

[docker/webserver.cordis.yml](../../../../docker/webserver.cordis.yml) is a launcher `--patch` that replaces the `webserver` row config with `host: 0.0.0.0` and keeps `port: !!js ctx.webStartup.port ?? 3080`. The entrypoint is `dsh web --patch /etc/dsh/webserver.cordis.yml --no-open`; `--port` remains an app argument.

`Release (docker)` (`.github/workflows/release-docker.yml`) publishes `ghcr.io/starpivotnet/deepseek-harness` on `desktop-v*` and `docker-v*` tags, and on a manual dispatch with `publish=true`. Tags are `sha-<12>`, the desktop package version, the git tag name, and `latest`. The job pulls the version tag and runs `dsh --version` before it finishes.

## Alternatives considered

**Publish `npx @deepseek-ai/dsh` inside the image.** Rejected because that install is the official tree and omits this fork's Host rows.

**Start `FROM` a third-party dsh image and layer patches.** Rejected because the base already lacks the customizations, and a layer cannot reconstruct marketplace, session-control, or automation from missing source.

**Pass `--host 0.0.0.0` as an app flag.** Rejected because `web-startup` treats that value as a usage error. A `--patch` that replaces the `webserver` row config is the supported bind override.

**A sixth `docker-v*` sequence that never shares `desktop-v*`.** Rejected as the default path. Desktop and container both ship this checkout's Host; sharing `desktop-v*` keeps one version line. `docker-v*` remains available when a container-only rebuild is required.

**Copy `.git` into the build context so `git rev-parse HEAD` works.** Rejected: the context would carry history the image does not need. The client build already accepts `DSH_CLIENT_COMMIT_HASH`, which is the source commit.

**Rely on `pnpm deploy --legacy --prod` alone for the Host closure.** Rejected: workspace `link:` overrides omit cosmokit/schemastery, and Cordis plugin peers such as group stay off the CLI production graph. The deployed tree cannot import them until they are copied back.

**Restore with `pnpm exec tsx` after deploy.** Rejected: `pnpm exec` re-runs a production install of the repository root, and the leftover `postinstall` then fails because `lefthook` is a devDependency.

## Consequences

A desktop or docker tag rebuilds GHCR from this checkout. Official npm and third-party images stay unused for StarPivot deployments.

What this costs:

- **Image size.** The runtime embeds a `pnpm deploy` of `@deepseek-ai/dsh`.
- **Build time.** Each publish runs a full workspace install and build on `ubuntu-24.04`.
- **GHCR visibility.** The package is under `StarPivotNet`; first-time consumers need `docker login ghcr.io`.
- **No multi-arch matrix in this sequence.** The published image is the Ubuntu runner's architecture.

## Testing

`scripts/docker/image.spec.ts` pins the overlay bind host, the launcher `--patch` / app `--port` split, the Dockerfile deploy of this checkout, the required `DSH_CLIENT_COMMIT_HASH` build-arg, the vendored-host restore, the GHCR name, and the workflow tag triggers. `scripts/docker/restore-vendored-host.spec.ts` copies omitted vendor packages into a fake deploy tree. `Release (docker)` is the executed build-and-publish path.
