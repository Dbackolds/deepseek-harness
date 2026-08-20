# Agent Note: Trusted session-control directory

Status: implemented

English | [中文](2026-08-19-trusted-session-control-directory.zh.md)

## Problem

Hosts and plugins that need to find every session, read whether it is running, stop a turn, or deliver a later message currently assemble `ctx.sessionQuery`, `ctx.agents`, and `ctx.sessions` themselves. That duplicates title folding, live-status vocabulary, and the resume-ownership fence. The existing model tools stay parent-to-child, and `session.list` is a Host RPC rather than an in-process service.

## Decision

`@deepseek-ai/dsh-session-control` publishes `ctx.sessionControl` as a trusted in-process directory. `search()` and `get()` list the live-preferred corpus from `ctx.sessionQuery.listSessions()`, attach each row's latest title, live Agent status (`running` / `idle` / `ready`), and registry-global `archived` bit when `ctx.workspaceRegistry` is mounted, and filter a case-insensitive substring against session id, cwd, and title. `search()` `archive` defaults to `all` and may be `only` or `exclude`; that filter runs before `limit`. `stop()` cancels a live Agent with `keepInbox: true` and treats a known identity without a driver as an accepted no-op. `send()` delivers one non-empty text block through `followup()` or `steer()` and records source `{ kind: 'plugin', plugin: 'session-control' }`.

The service never calls `ctx.agents.resume()`. A known storage-only identity fails with `SESSION_CONTROL_RESUME_REQUIRED`; an unknown identity fails with `SESSION_CONTROL_SESSION_NOT_FOUND`. Resume returns an `AgentHandle` that the Host resolver or subagent continuation manager must retain, so a shared directory that discarded the handle would steal ownership from those owners.

The shipped base composition mounts the package. It registers no model-facing tool and performs no caller authorization.

## Alternatives considered

- **Widen `ctx.sessionQuery`** — rejected because query is a read-only corpus service. Stop and send mutate a live Agent and do not belong on the same key.
- **Reuse `send_message` / `session.prompt`** — rejected because those surfaces are parent-authorized or Host-RPC. An in-process plugin needs a same-process API that can address any live session without a parent Agent or wire payload.
- **Resume cold sessions inside `send()`** — rejected because `AgentHandle` ownership is already claimed by the Host resolver and the continuation manager. Taking a second handle would collide on dispose.
- **Search message bodies** — rejected because `ctx.sessionQuery.searchSessions()` already owns full-text discovery, and the default composition keeps that index off.

## Consequences

Plugins can enumerate every logical session, read live status, stop a turn, and deliver a later message without duplicating title folding or the resume fence. Cold delivery still requires the caller to resume through an owner that keeps the handle. Default Web and TUI compositions gain the service; models do not see a new tool.
