# session-query/：会话检索能力家族

[English](README.md) | 中文

本家族提供经过授权的实时与持久会话日志检索，且独立于压缩（compaction）。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`session-query/`](session-query/README.zh.md) | 定义可信读取、关系查询和搜索操作 | `ctx.sessionQuery` |
| [`session-query-sqlite/`](session-query-sqlite/README.zh.md) | 使用 SQLite 全文搜索实现会话查询 | `ctx.sessionQuery` |
| [`session-control/`](session-control/README.zh.md) | 搜索全部会话及其实时状态、停止轮次并投递消息 | `ctx.sessionControl` |
| [`tool-session-control/`](tool-session-control/README.zh.md) | 向模型公开会话控制的搜索、停止、投递、改名与库管理 | 注册到 `ctx.tools` |
| [`session-log-export/`](session-log-export/README.zh.md) | 在 Host ZIP 端点之上增加 Web `/export` 命令、共享浏览器下载状态和结果弹窗 | `ctx.sessionLogDownload` |
| [`tool-session-query/`](tool-session-query/README.zh.md) | 向模型公开经过工作区授权的会话查询 | 注册到 `ctx.tools` |

子系统参考见 [session-query.md](../../docs/subsystems/session-query.zh.md) 与 [session-control.md](../../docs/subsystems/session-control.zh.md)。
