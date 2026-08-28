# Agent Note: Register No Repo at gateway activation

Status: implemented

English | [中文](2026-08-20-no-repo-workspace-boot-registration.zh.md)

## Problem

Web grouping lists No Repo only when that path already has a workspace record. `session.create` without `workspaceId`/`cwd` creates `$DSH_HOME/no-repo` and attaches there, but `workspace.list` before that first omitted-project create never includes the row. Sidebar New Session then follows the current Session's Workspace, and cold start falls through to the most recent visible project. A user cannot open a No Repo conversation from the grouped sidebar.

The [session rehome proposal](../../proposed/feature/2026-08-20-session-rehome.md) already required the Host to register that directory with title `No Repo` at workspace-registry start. Only the omitted-project attach path shipped.

## Decision

`WorkspaceController` registers No Repo from `[Service.init]` through `ensureNoRepoWorkspace`: mkdir `$DSH_HOME/no-repo` if needed, then `workspaceRegistry.create(path, 'No Repo')` only when that canonical path is unowned. A hidden owner stays hidden, so Hide survives later boots. The call reads the registry with `ctx.get` so a live-reload dispose does not throw. Direct `new WorkspaceController` in tests does not run this hook; omitted-project create still attaches there.

Sidebar New Session without an explicit Workspace still prefers the current Session's Workspace, then visible No Repo, then the most recent visible Workspace.

## Alternatives considered

**Register from `workspace.list`.** Rejected because a list RPC would mutate durable registry order on every reconnect baseline.

**Call `workspace.create` unconditionally at boot.** Rejected because that path shows a hidden owner in place, undoing Hide after a restart.

**Change unscoped New Session to always land in No Repo.** Rejected by the product choice that the sidebar group `+` remains the No Repo entry while the top New Session control stays on the current project.

## Consequences

Existing Hosts gain a No Repo row on the next gateway start without waiting for an omitted-project create. A Host that already hid No Repo keeps it hidden. Tests that construct the controller without the plugin hook still start with an empty registry.

## Testing

`packages/api/workspace-controller/tests/workspace-controller.host.spec.ts` covers the inactive-registry no-op. Omitted-project create still attaches at the canonical No Repo path.
