# Agent Note: User-authored subagent definition library

Status: implemented

English | [中文](2026-08-15-user-subagent-definition-library.zh.md)

## Problem

A parent can start a child with a persona and a tool filter, but those values live on the tool instance or the start request. A product user who wants a reusable reviewer, researcher, or writer has no settings page that stores those definitions and no model-facing way to pick one by name.

The settings dialog already owns Models, Plugins, Agent presets, and System prompts. A definition library belongs with those product surfaces: between Models and Plugins, as a named child composition the model can choose.

## Decision

A Settings section `user-subagents` stores a process-wide library of named child definitions. Each definition has an id, a display name, a short description, a persona, and optional `allow` / `deny` tool lists. The Web settings page between Models and Plugins owns create, edit, and delete. Writes go through `settings.replace`.

`dsh-user-subagents` registers that section with an empty composition entry and publishes `ctx.userSubagents`. `dsh-tool-subagent` reads the live library. A non-empty library adds an optional `agent` enum to the parent `subagent` tool. Choosing an id applies that definition's persona and tool filter at start. Omitting `agent` keeps the tool instance's configured composition. An unknown id fails at the tool boundary.

A definition does not choose a provider, a model, or a depth cap. Those remain tool-instance configuration. A running child keeps the composition it started with after the library row is later edited or deleted.

## Alternatives considered

Mounting one `tool-subagent` instance per definition would give each row its own tool name. That multiplies model-facing tools and still needs a settings page to add or remove instances. One tool plus an `agent` enum keeps the existing `subagent` / `subagent_fork` names.

Authoring full agent presets for each child would reuse the preset roster. A preset owns the whole composition, not a reusable child persona. The library is a smaller object that the parent applies at start.

## Consequences

The parent tool schema grows with every listed definition id and description. Creating, renaming, deleting, or reordering a definition can invalidate KV-cache reuse from the first changed tool-schema token.

The library is process-wide. Every parent that can call `subagent` sees the same rows. Tool names on the settings page are typed by hand; the page does not list the live global catalog.

## Testing

Host unit tests cover validation, lookup, composition mapping, and Settings layering. The delegation-tool suite covers an empty library omitting `agent`, a listed enum applying the selected composition, and an unknown id failing. The Web settings page has apply, store, and component coverage, plus the settings-chrome snapshot and e2e switch through the new nav row.
