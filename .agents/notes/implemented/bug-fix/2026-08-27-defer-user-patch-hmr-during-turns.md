# Agent Note: Defer user-patch HMR until live agents are idle

Status: implemented

English | [中文](2026-08-27-defer-user-patch-hmr-during-turns.zh.md)

## Problem

Writing `$DSH_HOME/profiles/<name>/cordis.patch.yml` during a live turn triggered `watchUserPatches` immediately. Recomposing the root Include disposed the plugin tree that owned the running Agent, which cancelled the turn as `{ kind: 'aborted', reason: { kind: 'disposed' } }`. The code-runtime abort path then did `String(signal.reason)`, so the model-facing `run_code` result was `Error: code run failed (abort): [object Object]` and nested tools such as `write` settled as `Error: tool call aborted`. Because a disposed abort is a completed turn rather than crash-recovery `interrupted`, Host did not auto-continue; the agent stopped until a later human prompt. The same session could then be continued only by the user sending 继续.

## Decision

`watchUserPatches` waits for every live `ctx.agents` entry to become idle before recomposing. HMR still serializes file generations, so a write during a turn applies the latest file contents after that turn settles instead of aborting it. Assemblies without an agents registry keep the previous immediate refresh. Abort-signal diagnostics use `formatAbortReason` from `dsh-session`: a typed `AgentCancelCause` renders as `cancelled by user`, `cancelled by parent`, `agent disposed`, `cancelled by hook: <reason>`, or `cancelled by automation <ruleId>`. `dsh-code-runtime-worker-thread` and Code Mode's run-over messages call that helper instead of `String(reason)`.

## Alternatives considered

**Treat disposed abort as crash-recovery `interrupted` and auto-followup.** Rejected: disposal is a completed turn with a typed cause, not an open log that needs synthetic closers. Folding it into restart resume would wake agents after intentional unloads.

**Have `write` refuse the live profile patch file.** Rejected: the file is a legitimate configuration target; the defect is that applying it kills the writer, not that the write is forbidden.

**Keep `String(reason)` and only defer HMR.** Rejected: any remaining abort of a typed cause (user stop, parent cancel, hook) would still surface `[object Object]` to the model.

## Consequences

A same-turn write of `cordis.patch.yml` no longer aborts that turn. The new composition still lands after idle, so a patch that changes tools or models takes effect on the next turn rather than mid-tool. `dsh-app-boot` optionally types `ctx.agents` through `dsh-agent`; assemblies without that service skip the wait. Model-facing abort text is now a stable English phrase instead of `[object Object]`.
