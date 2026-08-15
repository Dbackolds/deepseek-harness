# Agent Note: Web Automation sidebar

Status: implemented

English | [中文](2026-08-15-web-automation-sidebar.zh.md)

## Problem

Host Automation already owns durable rules, Host RPC, and model tools, but the Web GUI had no product entry. The only human path was asking the model to call the tools, which a person who wants to inspect or create a rule should not need. The [Host-owned Automation runs](2026-08-15-host-owned-automation-runs.md) note left Settings UI as follow-up on the same service.

## Decision

`ui-sidebar` declares `sidebar.automation` under New Session. `@deepseek-ai/dsh-client-ui-automation` occupies that seat with a trigger that opens a modal over the existing `automation.*` wire: list, create (exactly one of after / at / every / local-clock), enable, run-now, and delete. The Host remains the fact source. The panel does not add a Settings nav page, because the product request is a sidebar entry next to New Session, and a second home would split the same collection.

Create stays on the four selectors the service already accepts. The form does not parse natural language and does not edit an existing selector.

## Alternatives considered

**A Settings section.** The Host note named Settings as the later human surface. A Settings page would hide the collection behind another click and would not match the request to put Automation under New Session.

**A footer action next to Settings.** Footer actions are additive and sit at the bottom of the column. The request is a sibling of New Session.

**Fold the UI into ui-sidebar.** The shell owns geometry only. A Host-backed collection is a feature plugin, matching ui-jobs and ui-settings-models.

## Verification

Package tests cover slot registration and HMR disposal, store list/create/enable/run-now/delete, selector summaries, draft validation, and the trigger/list/create panel. The Web e2e scenario creates an `after` rule through the real Host and asserts it in the panel. Sidebar shell snapshots include the empty `sidebar.automation` hole.

## Consequences

Fired Sessions still appear in the ordinary list with `origin: 'automation'`. A stopped Host still does not fire. Model tools remain the only path that creates a rule from inside a live root turn.
