# Agent Note: Register No Repo at gateway activation

Status: implemented

English | [中文](2026-08-20-no-repo-workspace-boot-registration.zh.md)

## Problem

Web grouping lists No Repo only when that path already has a workspace record. `session.create` without `workspaceId`/`cwd` creates `$DSH_HOME/no-repo` and attaches there, but `workspace.list` before that first omitted-project create never includes the row. Sidebar New Session then follows the current Session's Workspace, and cold start falls through to the most recent visible project. A user cannot open a No Repo conversation from the grouped sidebar.

The [session rehome proposal](../../proposed/feature/2026-08-20-session-rehome.md) already required the Host to register that directory with title `No Repo` at workspace-registry start. Only the omitted-project attach path shipped.

## Decision

`ApiProxyService` activation awaits `ensureNoRepoWorkspace`: mkdir `$DSH_HOME/no-repo` if needed, then `workspaceRegistry.create(path, 'No Repo')` only when that canonical path is unowned. A hidden owner stays hidden, so Hide survives later boots. Direct `createApiProxy` callers, including package tests, do not run this registration; omitted-project create still attaches there.

Sidebar New Session without an explicit Workspace still prefers the current Session's Workspace, then visible No Repo, then the most recent visible Workspace.

## Alternatives considered

**Register from `workspace.list`.** Rejected because a list RPC would mutate durable registry order on every reconnect baseline.

**Call `workspace.create` unconditionally at boot.** Rejected because that path shows a hidden owner in place, undoing Hide after a restart.

**Change unscoped New Session to always land in No Repo.** Rejected by the product choice that the sidebar group `+` remains the No Repo entry while the top New Session control stays on the current project.

## Consequences

Existing Hosts gain a No Repo row on the next gateway start without waiting for an omitted-project create. A Host that already hid No Repo keeps it hidden. Tests that construct `createApiProxy` without the plugin still start with an empty registry.

## Testing

`packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` covers boot registration of an empty No Repo row, idempotent reuse of that row, and a later boot that does not show a hidden No Repo. Omitted-project create still attaches there.
