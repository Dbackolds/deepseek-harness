# Agent Note: Cold rehome membership projection

Status: implemented

English | [中文](2026-08-21-cold-rehome-membership-projection.zh.md)

## Problem

`session.rehome` appends `workspace/home` and moves the workspace account without rewriting `SessionHeader.cwd`. Live attach already validated that overlay, so the session sat under the target workspace until Host restart. Startup rebuilt the membership index from birth cwd only, filtered the accounted id out of the target workspace, and the sidebar showed it under Chat (the no-project remainder; Host still calls that bucket Ungrouped).

The [session rehome proposal](../../proposed/feature/2026-08-20-session-rehome.md) recorded that cold Ungrouped appearance as acceptable. Web grouping does not: a rehomed conversation must stay in its current workspace without being opened, not in Chat.

## Decision

Workspace membership home is the last `workspace/home` overlay, else `SessionHeader.cwd`. `git/worktree` remains a same-repo overlay and does not change membership.

First-boot grouping still uses header cwd only and does not inspect event bodies. After the initialized marker, accounted sessions are projected by membership home: a live log wins; otherwise non-mutating `inspect` supplies the overlay. `load` stays unused. Inspect runs only for ids already on a workspace account. One inspect failure falls back to header cwd and does not abort registry startup. Later header lookups that lack overlay events keep an already-indexed overlay home instead of rewriting it from birth cwd.

Cold attach uses the same membership home, so a persisted `workspace/home` can attach to the overlay workspace without publishing the session. Host `session.rehome` treats an already-matching membership home as the no-op, not tool cwd, so a `git/worktree` overlay that happens to equal the target still appends `workspace/home`.

## Alternatives considered

**Rewrite `SessionHeader.cwd` on rehome.** Rejected: birth cwd is persistence identity and the JSONL location key.

**Treat `git/worktree` as a membership move.** Rejected: that overlay isolates a branch inside the current project; sidebar grouping must stay on the workspace.

**Inspect every persisted session at startup.** Rejected: cwd-only sessions stay Ungrouped after bootstrap, and scanning unused logs would add I/O without changing grouping.

**Keep cold Ungrouped until the session is opened.** Rejected by the Web grouping contract: restart must not spill a rehomed conversation into Chat.

## Consequences

Accounted rehomed sessions remain under the overlay workspace after Host restart. Chat still collects sessions with no project account or a mismatched home. First-boot historical grouping is unchanged.

## Testing

`packages/workspace/workspace/tests/workspace.spec.ts` covers cold attach to a `workspace/home` overlay, restart projection onto the overlay workspace, `git/worktree` not moving membership, overlay mismatch filtering a sibling without aborting startup, and later archive/attach lookups that must not rewrite overlay homes from birth cwd. `packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` covers live rehome and a `git/worktree` overlay that already matches the target still writing `workspace/home`.
