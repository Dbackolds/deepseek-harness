# Agent Note: Agent preset 旧 id 别名

Status: implemented

[English](2026-08-29-agent-preset-legacy-id-alias.md) | 中文

## Problem

code-mode → ptc 的改名（`3ca9c7d489`）按其信息所述只改"不写入会话日志"的地方，持久词表交给 SESSION_FORMAT_VERSION v1 迁移处理。在迁移落地之前，改名前创建的每个会话都记录着 `agentPreset: "code"`，恢复时在 roster 处直接失败：`agent-presets: preset "code" not found (available: standard, ptc, minimal, cordis)`。升级后的部署上，全部改名前的历史会话都无法恢复。

## Decision

`AgentPresets.resolve` 把缺失的旧 id 映射到改名后的继任者：`LEGACY_PRESET_IDS` 目前携带 `code` → `ptc`，并且仅在没有任何 root 提供所请求 id 时才回退到继任者，因此部署自定义的 `code` preset 仍然优先。实际挂载的组装是继任者的；会话日志继续记录会话实际用过的词表——这正是改名自身契约宣布为持久的内容。别名放在 `resolve` 里，`resolveMountable`、resume 与 fork 全部继承；`list()` 仍只显示真实 preset。

v1 会话迁移重写持久预设 id 之后，这张映射表就是要删的东西。

spec fixture 覆盖两侧：带 `ptc` 的 roster 能把 `code` 解析到它；没有继任者的 roster 仍以 unknown-id 错误拒绝 `code`。

## Consequences

携带本改动的部署上，改名前的会话全部可以恢复，别名只在原本就失败的那条路径上多付一次映射表查找。这张表时刻提醒：preset id 是持久标识符——今后每次 preset 改名都必须在这里补条目（或落地让本表退役的 v1 会话迁移）；在仍引用某 id 的会话消失前删掉条目，会再次破坏它们的恢复。部署若有意让某个改名后的 id 消失，必须删除或迁移引用它的会话。

## Alternatives considered

**升级时改写会话日志。** 否决：持久会话数据属于计划中的 SESSION_FORMAT_VERSION 迁移，为追一次改名而手改日志正是该迁移要接管的折腾。

**发布一个用户级 `code` preset 拷贝。** 否决：它让旧 id 重新出现在每个新会话的 picker 里，并把出厂组装分叉成一份会默默腐烂的副本。
