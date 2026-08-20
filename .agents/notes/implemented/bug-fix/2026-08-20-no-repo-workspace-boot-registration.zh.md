# Agent Note: 在网关激活时注册 No Repo

Status: implemented

[English](2026-08-20-no-repo-workspace-boot-registration.md) | 中文

## Problem

Web 分组只有在该路径已有 workspace 记录时才会列出 No Repo。不带 `workspaceId`/`cwd` 的 `session.create` 会创建 `$DSH_HOME/no-repo` 并在那里 attach，但在第一次省略项目创建之前，`workspace.list` 从不包含这一行。侧栏新建会话于是跟随当前 Session 的 Workspace，冷启动则落到最近的可见项目。用户无法从分组侧栏打开 No Repo 对话。

[会话改挂提案](../../proposed/feature/2026-08-20-session-rehome.md) 已经要求 Host 在 workspace 注册表启动时，用标题 `No Repo` 注册该目录。实际只交付了省略项目的 attach 路径。

## Decision

`ApiProxyService` 激活时等待 `ensureNoRepoWorkspace`：必要时 mkdir `$DSH_HOME/no-repo`，仅当该规范路径尚无拥有者时才调用 `workspaceRegistry.create(path, 'No Repo')`。已隐藏的拥有者保持隐藏，因此 Hide 能在后续启动后保留。直接调用 `createApiProxy` 的调用方（包括包测试）不会执行这次注册；省略项目创建仍会在那里 attach。

不带显式 Workspace 的侧栏新建会话仍优先当前 Session 的 Workspace，然后是可见的 No Repo，再然后是最近的可见 Workspace。

## Alternatives considered

**在 `workspace.list` 里注册。** 否决：列表 RPC 会在每次重连基线上改写持久注册表顺序。

**启动时无条件调用 `workspace.create`。** 否决：该路径会就地显示已隐藏的拥有者，重启后撤销 Hide。

**把未指定目标的新建会话一律落到 No Repo。** 否决：产品选择是侧栏分组上的 `+` 作为 No Repo 入口，顶部新建会话控件仍留在当前项目。

## Consequences

已有 Host 会在下一次网关启动时得到 No Repo 行，无需等待省略项目创建。已经隐藏 No Repo 的 Host 会继续隐藏它。不经过插件、直接构造 `createApiProxy` 的测试仍从空注册表开始。

## Testing

`packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` 覆盖空 No Repo 行的启动注册、该行的幂等复用，以及后续启动不会显示已隐藏 No Repo。省略项目创建仍会在那里 attach。
