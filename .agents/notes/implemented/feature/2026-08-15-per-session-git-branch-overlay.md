# Agent Note: Per-session Git branch overlay on the new-session screen

Status: implemented

English | [中文](2026-08-15-per-session-git-branch-overlay.zh.md)

## Problem

The new-session composer already has a workspace chip and an agent-preset chip. The empty seat beside them is the natural place to pick a Git branch, and He asked for each conversation to keep its own branch. `SessionHeader.cwd` cannot move after create: workspace membership, persistence project directories, and attach validation all key off that immutable path. Checking the workspace checkout out from two sessions would also fight over one HEAD.

## Decision

Keep `SessionHeader.cwd` as the workspace membership key. Record a per-session overlay as one log-only `git/worktree` event. The last event is the directory tools, `{{cwd}}`, and `sandboxPolicy.resolve()` use; without one they keep the header cwd. Checking out the workspace HEAD reuses the workspace checkout. Any other name creates or reuses a linked worktree at `$DSH_HOME/worktrees/<workspace-id>/<session-id>` so two sessions can sit on different branches.

The Web chip fills `conversation.hero.branch` beside the existing hero chips. It talks to `git.describe` / `git.checkout` / `git.createBranch`. A workspace that is not a Git checkout hides the chip. The picker lists local short names and remote-tracking names that include the remote (`origin/master`); it does not collapse a remote-tracking name onto a same-named local head. A detached workspace HEAD that uniquely matches one local or remote-tracking name shows that name; several names at the same commit show the short object id instead of the literal `HEAD`.

## Alternatives considered

**Rewrite `SessionHeader.cwd` on switch.** Would isolate the working directory without worktrees, but workspace attach and membership require the header cwd to equal the workspace path, and persistence keys project directories off that path. Moving it would drop the session out of its workspace.

**Check the workspace checkout out in place.** Needs no extra directories, but two sessions cannot hold different branches, and a switch mid-turn would yank files out from under the other conversation.

**Put the control in the session header instead of the hero row.** The empty seat He marked is on the new-session screen, next to workspace and preset. The overlay still applies after the first message; the chip stays on that hero row because that is where the other pre-turn choices already live.

## Consequences

Each session can hold a different branch without moving workspace membership. Isolated worktrees live under `$DSH_HOME` and are force-removed when the session returns to the workspace HEAD. Uncommitted work in an abandoned isolated tree is not merged back. The model sees the overlay path through `{{cwd}}` and the sandbox policy context, not through a new prompt section.

## Testing

The overlay fold, sandbox-policy resolve, host `git.*` RPCs, isolated worktree create/checkout/return paths, remote-tracking names that keep the remote prefix, and detached HEAD labels are pinned by package tests against a real Git repository. The hero chip load, hide-when-not-a-repo, checkout, remote-tracking checkout, create, and HMR-safe slot registration paths are pinned by `ui-git-branch` client tests.
