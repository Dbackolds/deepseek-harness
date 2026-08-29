# Agent Note: Client panels must declare their Remote namespaces

Status: implemented

English | [中文](2026-08-29-client-panel-remote-namespace-inject.zh.md)

## Problem

The gateway client installs each Remote namespace as a traced `remote.<namespace>` service instead of exposing them through a JavaScript Proxy. Reading `ctx.remote.<namespace>` therefore resolves through the context reflector and requires the caller to declare `remote.<namespace>` in its `inject`. The settings shell and the General panel declared theirs; the Subagents, Skills, and System prompts panels declared only `remote` and read `ctx.remote.settings` / `ctx.remote.skills` / `ctx.remote.llm` / `ctx.remote.systemPrompt` directly, so every one of those pages failed with `cannot get property "remote.settings" without inject` as soon as its data call ran.

## Decision

Each panel declares every namespace it reads: `ui-settings-subagents` gains `remote.settings`, `ui-settings-skills` gains `remote.skills`, and `ui-settings-system-prompts` gains `remote.settings`, `remote.llm`, and `remote.systemPrompt`. Their specs pin the full inject lists and provide the namespace stubs the declaration demands.

## Consequences

The declaration is now load-bearing in both directions: a panel that reads an undeclared namespace fails its own spec fixture instead of shipping, and the gateway client is free to keep namespace services traced rather than reverting to a Proxy that would silently relax the contract. Adding a Remote read to a client panel now always pairs with an inject entry — the same rule the host side already follows for plain services.

## Alternatives considered

**Revert the gateway client to a Proxy over namespaces.** Rejected: the traced services exist so a page fails visibly when its namespace is absent (auth-era namespaces are no longer universally present), and a Proxy would hide that as a runtime undefined instead.

**Have the settings shell inject all namespaces and hand them down.** Rejected: it would re-create the per-panel hidden dependency the inject lists exist to surface, and the shell cannot know which namespaces a section's body reads.
