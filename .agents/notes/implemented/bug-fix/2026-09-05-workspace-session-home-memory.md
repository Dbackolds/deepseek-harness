# Agent Note: Remember workspace membership homes per artifact revision

Status: implemented

English | [中文](2026-09-05-workspace-session-home-memory.zh.md)

## Problem

After the 0.1.3 upstream merge, a desktop/web Host with a real session history took 15–120+ seconds to reach readiness (was ~3s on 0.1.2-rc.1), with the window stuck on the loading page and one CPU core saturated. A CPU profile pinned ~67% of startup CPU to `dsh-session-persistence-jsonl` replay: `WorkspaceRegistry`'s startup overlay re-index inspects every accounted session's full log (to find the last `workspace/home` event), and for the 325 v0/v1 sessions in that store every read re-attempts a format migration that is deterministically refused (`unknown historical event type "git/worktree"`, `replayState has unexpected member "kind"`), then throws, then is swallowed as a header-cwd fallback. The refusal never lands on disk, so every boot re-pays decode + migration + deep snapshot (`snapshotSessionFormatArtifact` deep-copies and freezes the whole artifact) for the same unchanged artifacts — indefinitely.

## Decision

`WorkspaceRegistry` now remembers each accounted session's resolved membership home in the workspace domain's global state (`sessionHomes`, keyed by session id), alongside the persistence artifact revision the answer was computed from. On boot, a hit (same revision) replays the remembered home with no log read; a miss re-inspects and rewrites the memory. A refused inspection is remembered as its header-cwd fallback — a refusal is a stable property of the artifact bytes, so retrying it on every boot is pure waste. Live sessions still win over the memory (their snapshot is free and fresher), a changed revision re-inspects, and memories for sessions absent from a full listing are swept so the table cannot outgrow the store. The state field carries a zod default, so stores written before it exist parse unchanged (the same pattern as `archivedSessionIds`/`hiddenWorkspaceIds`).

## Alternatives considered

- **Persist migration refusals in the session store** (a per-artifact refusal marker beside the log). Fixes the repeated refusal cost for every consumer, not just the workspace index, but adds a new on-disk artifact format to the session-persistence seam mid-cycle; the workspace memory already removes this boot's dominant cost with derived data only.
- **Skip the full-log read by scanning a tail window for `workspace/home`.** Cheaper per boot but changes membership semantics — the last overlay may sit before any fixed window — for a cost the revision-keyed memory removes without semantic change.
- **Speed up the migration itself** (skip the detach copy for values that just came out of `JSON.parse`). Worth doing for one-time migrations, but irrelevant here: the refused sessions never reach migration output, and the per-boot cost was the repeat, not the single pass.

## Consequences

Startup replay over an unchanged session store is header-cost only (profile: session-related CPU fell from 67% to ~1% of samples, total busy samples down ~90%); the first boot after the change pays one inspect pass to populate the memory. A session whose artifact grows or migrates re-inspects once and is remembered again. The memory is derived data: deleting the storage file or a stale read costs one re-inspect pass, never correctness. The domain state gains a defaulted field rather than a version bump (single-layout stores stay exact-version reads), so existing `workspace.json` stores open unchanged.

## Testing

`packages/workspace/workspace/tests/workspace.spec.ts` gains a `session-home memory` group: replay-from-memory on restart (no inspect), re-inspect and rewrite on revision change, the refusal fallback remembered and never retried, memories swept when sessions leave the store, and a live snapshot winning over a stored memory. The pre-existing state assertions carry the new defaulted field.
