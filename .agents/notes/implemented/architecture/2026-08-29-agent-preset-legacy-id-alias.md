# Agent Note: Agent preset legacy id alias

Status: implemented

English | [中文](2026-08-29-agent-preset-legacy-id-alias.zh.md)

## Problem

The code-mode → ptc rename (`3ca9c7d489`) renamed the preset id everywhere "that is not written into session logs", and its message defers the durable vocabulary to the SESSION_FORMAT_VERSION v1 migration. Until that migration lands, every session created before the rename records `agentPreset: "code"`, and resuming one dies at the roster with `agent-presets: preset "code" not found (available: standard, ptc, minimal, cordis)`. On an upgraded deployment the entire pre-rename history is unresumable.

## Decision

`AgentPresets.resolve` maps a missing legacy id to its renamed successor: `LEGACY_PRESET_IDS` currently carries `code` → `ptc`, and resolution falls back to the successor only when no root supplies the requested id, so a deployment that defines its own `code` preset keeps it. The mounted composition is the successor's; the session log keeps recording the vocabulary the session actually used, which is what the rename's own contract declares durable. The alias rides `resolve`, so `resolveMountable`, resume, and fork all inherit it; `list()` still shows only real presets.

When the v1 session migration rewrites durable preset ids, this map is the thing to delete.

Spec fixtures cover both sides: a roster that ships `ptc` resolves `code` to it, and a roster without the successor still refuses `code` with the unknown-id error.

## Consequences

Pre-rename sessions resume on every deployment that ships this change, and the alias costs one map lookup on the already-failing path. The map is a standing reminder that preset ids are durable identifiers: every future preset rename must add its entry here (or land the v1 session migration that retires the map), and deleting an entry before sessions referencing that id are gone re-breaks their resume. A deployment that intentionally wants a renamed id gone must delete or migrate the sessions that name it.

## Alternatives considered

**Rewrite session logs during upgrade.** Rejected: durable session data belongs to the planned SESSION_FORMAT_VERSION migration, and hand-editing logs to chase a rename is exactly the churn the migration exists to own.

**Ship a user-level `code` preset copy.** Rejected: it resurrects the legacy id in the picker for every new session and forks the shipped composition into a second copy that silently rots.
