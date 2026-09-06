---
description: "User-settings gate that hides session-history tools from every agent until enabled, for operators composing prior-session recall into their deployments."
kind: "package-reference"
---

# @deepseek-ai/dsh-session-history-gate

English | [中文](README.zh.md)

## Summary

`dsh-session-history-gate` makes model-facing session-history tools opt-in. While the gate is closed (the default), the configured tool names — the `agent_session_*` family registered by third-party search plugins plus the core `session_*` query tools — are restricted away from every live Agent: their schemas disappear from each agent's view and execution of a gated name fails as `UNKNOWN_TOOL`. A compensating system-prompt section tells the model the capability is disabled by a user setting and that it should ask the user to enable it when a task genuinely needs prior-session recall. Flipping the live `session-history-tools` setting on re-exposes the tools to every live session at its next model request, without restart.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this package when session-history tools are registered globally but must stay hidden until the user explicitly wants conversation recall. The gate composes over the tool registry: it does not register tools itself and never changes what the gated packages register — it restricts their visibility per Agent.

### When to choose it

Choose it when a deployment ships session-history search (`dsh-tool-session-query`, `dsh-session-search-pro`) but wants recall to be user-owned rather than free model memory. Without a settings provider in the composition the gate is permanently closed (fail-closed): restrictions and the compensating section stay active and no toggle can open them.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `tools` | the eight-name session-history family | Global tool names hidden while closed; unregistered names are skipped, duplicates collapse, and `run_code` is rejected at load |

The default set is `agent_session_list`, `agent_session_read`, `agent_session_search`, `session_search`, `session_event_search`, `session_trace`, `session_event_trace`, `session_event_read`. The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-session-history-gate) is the exhaustive source for every accepted field and its JSDoc.

### Closed and open behavior

While closed, every Agent created before or after the gate load — including subagents and teammates — has the currently registered gated names denied in its own scope; a gated tool that registers later is picked up on the next registry change. While open, no restriction exists and the compensating section is disposed. Toggling the `session-history-tools` setting disposes or re-applies every live agent's restriction; the change is visible at the next step assembly, because schemas are read per step. Losing the settings provider mid-run closes the gate again.

-----

<a id="model-experience"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The `tools/change` pass short-circuits on `appliedDeny` equality before sweeping agents, and the sweep itself emits further `tools/change` notifications that the one-pass `reconciling` flag skips; both guards exist because `restrict()` and its disposer notify synchronously. Keep that re-entrancy shape when extending the gate, and keep new gated names in the default `tools` list rather than hardcoding them in listeners.

</details>

## Model Experience

### System prompt

#### What the model sees

While the gate is closed, the model receives one fixed section stating the capability is user-disabled and naming the enabling route.

##### Session-history gate notice

```markdown
Session-history tools such as agent_session_search and session_search are disabled by a user setting; calling them will not work. Do not attempt them. When your task genuinely needs recalling prior sessions, ask the user to enable "Session history tools" in Settings.
```

#### Token effect

Conditional: the section is present only while the gate is closed; opening it removes the section entirely.

#### KV Cache effect

Prefix-stable while the closed state and text are unchanged; toggling the gate replaces this section's tokens and invalidates reuse from its position onward.

### Gated tool visibility

#### What the model sees

The gate contributes no tool of its own; while closed it removes the gated tools' schemas from every agent's request, and while open those schemas ship exactly as their owning packages register them.

#### Token effect

Conditional: gated schemas are absent while closed and reappear when the setting opens them.

#### KV Cache effect

Toggling adds or removes schema tokens at the tool block's position, invalidating reuse from there onward; an unchanged toggle state preserves the reusable prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when this package is a poor fit or needs special operational care. They are current package constraints, not a task backlog.

- **One host-global toggle** — the open/closed state applies to every Agent in the process; per-preset or per-session granularity is out of scope.
- **Agent-owned shadows survive** — a gated name registered in an Agent's own scope (a preset override) remains visible to that agent, because restrictions filter inherited global registrations only.
- **Fail-closed without a provider** — a composition without a settings provider keeps the gate permanently closed; opening requires composing a provider.

**Runtime invariant:** No companion is published. The gate owns no event or mutable data relationship beyond the tools, system-prompt, and settings registries that already validate registration.
