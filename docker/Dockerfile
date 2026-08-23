# syntax=docker/dockerfile:1
# Build the StarPivot fork from this checkout. Do not start from an official
# npm or third-party dsh image: those trees omit this repository's Host
# customizations (marketplace, session-control, automation, message edit).
FROM node:24-bookworm-slim AS build

WORKDIR /src
ENV CI=true \
    DSH_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY . .
RUN corepack prepare pnpm@11.7.0 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm run build \
  && mkdir -p /out \
  && pnpm --filter @deepseek-ai/dsh deploy --legacy --prod \
    --config.node-linker=hoisted \
    --config.auto-install-peers=true \
    --config.link-workspace-packages=true \
    /out/dsh

FROM node:24-bookworm-slim AS runtime

WORKDIR /workspace
ENV DSH_HOME=/var/lib/dsh \
    DSH_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN mkdir -p /var/lib/dsh /etc/dsh
COPY --from=build /out/dsh /opt/dsh
COPY docker/webserver.cordis.yml /etc/dsh/webserver.cordis.yml

EXPOSE 3080
VOLUME ["/var/lib/dsh", "/workspace"]

# --patch is a launcher flag and must precede app flags such as --port.
ENTRYPOINT ["node", "/opt/dsh/lib/bin.js", "web", "--patch", "/etc/dsh/webserver.cordis.yml", "--no-open"]
CMD ["--port", "3080"]
