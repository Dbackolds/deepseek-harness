# Spec: Cold rehome membership projection

Status: accepted
Date: 2026-08-21

## Goal

A rehomed conversation stays under its current workspace after Host restart. Sidebar grouping follows the last `workspace/home` overlay, not the immutable birth cwd.

## Scenario

1. Start a session in `deepseek-harness`.
2. Agent calls `session.rehome` to `dsh-plugins/session-rehome`.
3. Restart the Host without opening that session.
4. Sidebar shows the session under `session-rehome`, not Ungrouped.
5. The empty target workspace does not appear while its only member is filtered out.

## In-scope behavior

- Workspace membership projection (startup `sessionIds` filter, live attach, cold attach) uses the last `workspace/home` path when present, else `SessionHeader.cwd`.
- Cold sessions are inspected for overlay events. `inspect` is non-mutating; `load` stays unused.
- First-boot workspace bootstrap still groups by header cwd only. After the initialized marker, rehomed sessions already on a workspace account keep that account across restart.
- `git/worktree` remains a same-repo overlay and does not change workspace membership.
- Birth cwd, JSONL location, and session identity stay unchanged.
- Ungrouped remains the bucket for sessions that are not on any workspace account, or whose effective home no longer matches their account.

## Non-goals

- Rewriting `SessionHeader.cwd` or moving JSONL artifacts.
- Auto-adopting cwd-only sessions after bootstrap.
- Changing No Repo vs Ungrouped product roles.
- Session-query same-cwd authorization (stays birth cwd).
- TUI `/resume` grouping.
- Hiding empty workspaces for unrelated reasons.

## Constraints

- Header cwd remains persistence identity.
- Membership is still `id on Workspace.sessionIds` AND canonical effective home equals workspace path.
- Inspect failures for one session must not crash registry startup; that session stays filtered (Ungrouped) and the rest of the index continues.
- No schema / SESSION_FORMAT_VERSION bump.

## Acceptance evidence

- Registry unit: persisted session with birth cwd A, `workspace/home` to B, accounted under B, survives a second registry boot with `sessionIds` containing it under B and not A. `load` is not called.
- Registry unit: `git/worktree` overlay to another directory does not move membership.
- Registry unit: missing overlay still matches header cwd.
- Host: `session.rehome` then rebuild the workspace registry (or restart the harness in the test) keeps the session on the target workspace list.
- Focused tests in `packages/workspace/workspace` plus any Host coverage that currently only asserts live membership.

## Resolved decisions

- Overlay that owns membership: last `workspace/home` only.
- Cold overlay source: `sessionPersistence.inspect`, not `load`.
- First-boot bootstrap: still header cwd; this fix is post-initialized projection.
- Inspect failure: fall back to header cwd for that session.

## Remaining assumptions

- Scanning overlay events at workspace-registry start is acceptable; inspect is already used by other Host list paths.
- Live sessions still win over inspect when both exist.

## Repository facts

- Live attach already folded overlays in `effectiveSessionHome`; membership now uses `membershipHome` (`packages/workspace/workspace/src/entity.ts`).
- Startup index uses header cwd only (`indexHeader` in `packages/workspace/workspace/src/index.ts`).
- Proposed rehome note currently accepts cold Ungrouped until opened (`.agents/notes/proposed/feature/2026-08-20-session-rehome.md`); this spec supersedes that risk for Web grouping.
