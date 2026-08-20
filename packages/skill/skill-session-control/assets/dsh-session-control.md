# Session Control

Use the `session_control_*` tools to find any logical session, read whether it is running, stop its current turn, deliver a later message, rename it, or manage the conversation library (archive, unarchive, regroup).

These tools address ordinary sessions, forks, automation fires, and live subagent children. They are not limited to children you started in this turn.

## Tools

- `session_control_search` — list sessions with live status. Optional `query` matches session id, working directory, or title. Optional `limit` caps the page. Optional `archive` is `all` (default, include archived), `only`, or `exclude`. Archived rows are marked `archived`. Grouping surfaces still omit archived members. This tool does not search message bodies.
- `session_control_stop` — stop the current turn and keep queued inbox work. A known session with no live driver is an accepted no-op.
- `session_control_send` — deliver one non-empty text message. `mode` is `queue` (next turn, default) or `steer` (nearest step).
- `session_control_rename` — rename any logical session and pin the title against automatic regeneration. Empty titles fail. Present while the session-title service is mounted (shipped base).
- `session_control_workspaces` — list registered workspaces for grouping: id, title, path, hidden flag, and accounted session ids with archived conversations omitted. Present only while workspace grouping is mounted (Web).
- `session_control_archive` — hide one conversation from grouping surfaces. The log and its workspace slot stay. Already archived is a no-op. Present only while workspace grouping is mounted (Web).
- `session_control_unarchive` — restore one archived conversation to its prior slot. Does not open it. Known and not archived is a no-op. Present only while workspace grouping is mounted (Web).
- `session_control_rehome` — move one conversation's home and sidebar group to an existing directory. Do not mkdir. Canonical No Repo is refused. Present only while workspace grouping is mounted (Web).
- `session_control_reorder` — move an accounted conversation inside its current workspace. Omitted `before_session_id` appends. Ungrouped conversations must be rehomed first. Present only while workspace grouping is mounted (Web).

## Status

| activity | meaning |
|---|---|
| `running` | A live Agent has an active driver. |
| `idle` | A live Agent is attached between turns. |
| `ready` | The session exists in storage or the live store and has no live Agent. |

## Workflow

1. Call `session_control_search` when the user asks about another conversation, wants work coordinated across sessions, or you need an id you do not already have. Use `archive=only` to browse the archive library. After you have an id, read the log with a mounted session-read tool; do not invent a resume or body-read tool here.
2. Prefer an `idle` or `running` row for `session_control_send`. Use `session_control_stop` first when the user asked to interrupt that session.
3. If a send fails because the session is not live, report that the session must be resumed in the UI or by its owner. Do not invent a resume tool.
4. For library work, use the library tools only when they appear in the catalog. List groups with `session_control_workspaces`, archive finished threads, unarchive one that should return, rehome to change groups, and reorder only inside the current group. Rename with `session_control_rename` when it appears (shipped base). If library tools are absent, search, stop, send, and rename still work.
5. Do not use `send_message` or `interrupt_agent` for peer sessions. Those tools only address subagents you own.
6. Do not use `move_agent_to_root` to tidy someone else's conversation. That tool only moves the current session and may ask for confirmation.

## Rules

- Load this skill before searching, stopping, messaging, renaming, archiving, or regrouping another session.
- Copy session ids from tool results. Do not guess ids.
- Keep messages self-contained. The recipient does not see this conversation unless you include the needed context.
- Stopping keeps queued work. Say so if the user asked to cancel everything.
- Grouping is the workspace directory. Cross-group moves change the conversation home; same-group order does not.
- Archive hides a conversation from grouping surfaces only. The session log stays readable.
