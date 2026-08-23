# Agent Note: Infer Host Automation create intent

Status: implemented

English | [中文](2026-08-23-automation-infer-create-intent.zh.md)

## Problem

Users ask the live root Agent to create a Host Automation rule in ordinary language: create an automation, run something daily, or schedule later work. The five tools already exist, but the model often starts the work in the current session instead of calling `automation_create`. Tool descriptions mentioned later or repeating schedules; the assembled system prompt had no Host Automation policy of the kind [goal tools](../../../../packages/goal/tool-goal/README.md) register, so "create an automation" competed with ordinary coding work.

The [Host-owned Automation runs](../feature/2026-08-15-host-owned-automation-runs.md) decision still holds: the harness does not parse natural-language calendars. The missing piece is model guidance that names the product intent.

## Decision

`dsh-tool-automation` registers a fixed `tool:automation` system-prompt section and states the same infer-intent rule on `automation_create`. The model may infer a Host Automation create from a direct human request in any language, without the words Host Automation. It must write `task` as the future session prompt, choose exactly one selector, and not start that work in the current session or route it through reminders, goals, jobs, or workflows. Daily or weekly local times use `local_clock` with the request time zone from time context. Execution authority is unchanged: live root Agent, open turn, `{ kind: 'user' }`.

## Alternatives considered

**Parse the request in the harness and auto-fill a rule.** Rejected by the Host Automation note: time-context already supplies the zone, and a second parser would invent a calendar language.

**Rely on the existing tool description alone.** The reported session already had that description and still treated "create an automation" as immediate work. Goal, workflow, and Ralph tools already ship a prompt section for the same class of routing mistake.

**Hide the tools until an exact slash command.** That would block ordinary-language create, which is the product path the sidebar already documents as the in-conversation alternative.

## Consequences

Root Agents that load this plugin receive a stable prompt prefix naming when to create a rule. Semantic intent remains model judgment; execution still cannot prove the human asked for a timer rather than immediate work. Fired Sessions still cannot create more rules.

## Testing

Package tests pin the guidance text, the create-tool description, Loader-safe exports, and disposal of the prompt section.
