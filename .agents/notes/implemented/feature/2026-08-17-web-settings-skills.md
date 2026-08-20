# Agent Note: Web Settings Skills section

Status: implemented

English | [中文](2026-08-17-web-settings-skills.zh.md)

## Problem

The Web Settings panel had no catalog of discovered skills. Composer slash completion already lists user-invocable skills for one session, but a person inspecting built-in, user, and project skills should not need an attached session or a slash menu. Folding that catalog into `ui-skill` or the settings shell would mix invocation with management and hard-code a nav row the shell does not own.

## Decision

`@deepseek-ai/dsh-client-ui-settings-skills` registers `settings.section` id `skills` at `order: 17`, between Plugins (`15`) and Agent presets (`20`). The page is a read-only searchable card list modeled on the Plugins inventory: name, description, source tag, and a disclosure for provider plus both invocation flags. It registers no slash command.

`skill.list` stays the composer menu. Settings reads a new session-independent `skill.catalog` RPC. The Host merges the global layer with the deployment default preset's standing key at the gateway cwd, and returns every discovered skill — including built-in providers such as `dsh-badge` — regardless of invocation policy. That merge is required because the Web bundle disables the host `skill-filesystem` row; a global-only read would omit the user, project, and bundled roots the default preset mounts.

The settings shell maps `skills` to `IconSkillOutline16`. Unknown section ids still share the gear.

## Alternatives considered

**Reuse `skill.list`.** The Settings panel has no `sessionId`, and that RPC filters to user-invocable rows and omits source and provider.

**A Typert Remote like plugin inventory.** Skills already have an apiproxy domain; a second inventory service would duplicate listing without adding a Host-only capability.

**Authoring, enablement, or slash-command registration on the page.** Those need a writable namespace or a command registry the catalog does not own. The first page is inspection only.

**Mount the page inside `ui-skill`.** That package owns composer candidates and the tool row. A Settings section is a separate feature plugin, matching `ui-settings-subagents`.

## Verification

Package tests cover section registration and disposal, source-label mapping, search, disclosure, empty and retry states, and late-result containment. Api-proxy tests cover `skill.catalog` schema, carrier round-trip, default-preset standing scope, and the no-roster fallback. Settings-shell tests include the `skills` nav glyph. Web settings-chrome snapshots include the new nav row.

## Consequences

Creating, editing, deleting, or toggling a skill remains a filesystem or provider change. The page does not subscribe to `skills/change`; reopening Settings or retrying obtains a new snapshot.
