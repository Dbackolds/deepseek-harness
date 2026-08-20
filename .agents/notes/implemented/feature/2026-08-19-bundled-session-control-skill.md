# Agent Note: Bundled session-control skill and tools

Status: implemented

English | [中文](2026-08-19-bundled-session-control-skill.zh.md)

## Problem

`ctx.sessionControl` can search every logical session, stop a turn, and deliver a later message, but the model cannot see that capability. Parent-to-child `send_message` and opt-in `session_search` do not teach a peer-session workflow.

## Decision

`@deepseek-ai/dsh-skill-session-control` is a native Cordis plugin that registers one immutable bundled provider on `ctx.skills`. The provider owns the `dsh-session-control` summary and instruction body. `dsh-tool-skill` remains the sole owner of catalog and loader rendering.

`@deepseek-ai/dsh-tool-session-control` registers `session_control_search`, `session_control_stop`, `session_control_send`, `session_control_rename`, `session_control_workspaces`, `session_control_archive`, `session_control_unarchive`, `session_control_rehome`, and `session_control_reorder`. Search, stop, and send stay thin adapters over `ctx.sessionControl`. `session_control_search` passes `archive` (`all` / `only` / `exclude`, default `all`) and marks archived rows. Rename waits on `ctx.sessionTitle` and prefers Host `session.rename` when `ctx.apiProxy` is present. Library tools call `ctx.workspaceRegistry` and, for rehome, Host `session.rehome` when `ctx.apiProxy` is present. The shipped base composition mounts both the skill and the tools. The skill tells the model to load those instructions before coordinating across sessions or managing the conversation library, to use `archive=only` when browsing archived history, and to use these tools instead of parent-only `send_message`.

A storage-only send still fails with the service's resume-required error. Send, stop, and search do not call `ctx.agents.resume()`. Rehome and rename through Host may resume a cold session because the Host resolver keeps the `AgentHandle`. Without Host, rehome or rename of a storage-only session fails, and a live session whose header origin is `subagent` fails.

Cross-group moves change the conversation home. Same-group order uses `insertSessionBefore` and does not change cwd. `move_agent_to_root` remains the current-session confirmation tool in the session-rehome plugin.

## Alternatives considered

- **Skill only, no tools** — rejected because a catalog entry cannot execute search, stop, or send. The model would have no callable surface.
- **Teach `run_code` to call `ctx.sessionControl`** — rejected because Code Mode is not the default shipped roster, and the capability should be visible as ordinary tools.
- **Reuse `session_search` / `send_message`** — rejected because those surfaces are workspace-authorized history search and parent-to-child follow-up, not a peer-session directory.

## Consequences

Default Web compositions advertise `dsh-session-control` and expose the nine `session_control_*` tools. CLI and TUI compositions mount `sessionTitle` but not `workspaceRegistry`, so they expose search, stop, send, and rename. Cold send still remains an owner-held Host or continuation-manager operation. Package tests pin provider lifecycle and tool dispatch; the generated tool catalog harvests the schemas. The archive inverse RPC is recorded in [session archive](2026-07-31-session-archive-global-set.md).
