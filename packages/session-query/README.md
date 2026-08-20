# session-query/ — session retrieval capability family

English | [中文](README.zh.md)

This family provides authorized retrieval over live and durable session logs, independently of compaction.

| Package | Role | ctx key |
|---|---|---|
| [`session-query/`](session-query/README.md) | Defines trusted reads, relationship queries, and search operations | `ctx.sessionQuery` |
| [`session-query-sqlite/`](session-query-sqlite/README.md) | Implements session queries with SQLite full-text search | `ctx.sessionQuery` |
| [`session-control/`](session-control/README.md) | Searches every session with live status, stops a turn, and delivers a message | `ctx.sessionControl` |
| [`tool-session-control/`](tool-session-control/README.md) | Exposes session-control search, stop, send, and library tools to the model | registers on `ctx.tools` |
| [`session-log-export/`](session-log-export/README.md) | Adds the Web `/export` command, shared browser download state, and result modal over the Host ZIP endpoint | `ctx.sessionLogDownload` |
| [`tool-session-query/`](tool-session-query/README.md) | Exposes workspace-authorized session queries to the model | registers on `ctx.tools` |

The subsystem references are [session-query.md](../../docs/subsystems/session-query.md) and [session-control.md](../../docs/subsystems/session-control.md).
