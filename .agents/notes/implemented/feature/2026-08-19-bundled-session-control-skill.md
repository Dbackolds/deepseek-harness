# Agent Note: Bundled session-control skill and tools

Status: implemented

English | [中文](2026-08-19-bundled-session-control-skill.zh.md)

## Problem

`ctx.sessionControl` can search every logical session, stop a turn, and deliver a later message, but the model cannot see that capability. Parent-to-child `send_message` and opt-in `session_search` do not teach a peer-session workflow.

## Decision

`@deepseek-ai/dsh-skill-session-control` is a native Cordis plugin that registers one immutable bundled provider on `ctx.skills`. The provider owns the `dsh-session-control` summary and instruction body. `dsh-tool-skill` remains the sole owner of catalog and loader rendering.

`@deepseek-ai/dsh-tool-session-control` registers `session_control_search`, `session_control_stop`, and `session_control_send` as thin adapters over `ctx.sessionControl`. The shipped base composition mounts both the skill and the tools. The skill tells the model to load those instructions before coordinating across sessions, and to use these tools instead of parent-only `send_message`.

A storage-only send still fails with the service's resume-required error. The tools do not call `ctx.agents.resume()`.

## Alternatives considered

- **Skill only, no tools** — rejected because a catalog entry cannot execute search, stop, or send. The model would have no callable surface.
- **Teach `run_code` to call `ctx.sessionControl`** — rejected because Code Mode is not the default shipped roster, and the capability should be visible as ordinary tools.
- **Reuse `session_search` / `send_message`** — rejected because those surfaces are workspace-authorized history search and parent-to-child follow-up, not a peer-session directory.

## Consequences

Default Web and TUI compositions advertise `dsh-session-control` and expose three new tools. Cold resume remains an owner-held Host or continuation-manager operation. Package tests pin provider lifecycle and tool dispatch; the generated tool catalog harvests the new schemas.
