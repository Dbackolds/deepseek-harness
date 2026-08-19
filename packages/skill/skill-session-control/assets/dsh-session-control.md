# Session Control

Use the `session_control_*` tools to find any logical session, read whether it is running, stop its current turn, or deliver a later message.

These tools address ordinary sessions, forks, automation fires, and live subagent children. They are not limited to children you started in this turn.

## Tools

- `session_control_search` — list sessions with live status. Optional `query` matches session id, working directory, or title. Optional `limit` caps the page.
- `session_control_stop` — stop the current turn and keep queued inbox work. A known session with no live driver is an accepted no-op.
- `session_control_send` — deliver one non-empty text message. `mode` is `queue` (next turn, default) or `steer` (nearest step).

## Status

| activity | meaning |
|---|---|
| `running` | A live Agent has an active driver. |
| `idle` | A live Agent is attached between turns. |
| `ready` | The session exists in storage or the live store and has no live Agent. |

## Workflow

1. Call `session_control_search` when the user asks about another conversation, wants work coordinated across sessions, or you need an id you do not already have.
2. Prefer an `idle` or `running` row for `session_control_send`. Use `session_control_stop` first when the user asked to interrupt that session.
3. If a send fails because the session is not live, report that the session must be resumed in the UI or by its owner. Do not invent a resume tool.
4. Do not use `send_message` or `interrupt_agent` for peer sessions. Those tools only address subagents you own.

## Rules

- Load this skill before searching, stopping, or messaging another session.
- Copy session ids from tool results. Do not guess ids.
- Keep messages self-contained. The recipient does not see this conversation unless you include the needed context.
- Stopping keeps queued work. Say so if the user asked to cancel everything.
