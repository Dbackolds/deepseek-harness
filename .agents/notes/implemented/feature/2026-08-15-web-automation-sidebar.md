# Agent Note: Web Automation sidebar

Status: implemented

English | [中文](2026-08-15-web-automation-sidebar.zh.md)

## Problem

Host Automation already owns durable rules, Host RPC, and model tools, but the Web GUI had no product entry. The only human path was asking the model to call the tools, which a person who wants to inspect or create a rule should not need. The [Host-owned Automation runs](2026-08-15-host-owned-automation-runs.md) note left Settings UI as follow-up on the same service.

## Decision

`ui-sidebar` declares `sidebar.automation` under New Session. `@deepseek-ai/dsh-client-ui-automation` occupies that seat with a clock-icon trigger that matches New Session geometry, and occupies `shell.overlay` with a center-column page over the existing `automation.*` wire: list, create (exactly one of after / at / every / local-clock), enable, run-now, delete, and delete-run. The Host remains the fact source. The collection stays off Settings, because the product request is a sibling of New Session.

Create stays on the four selectors the service already accepts. Built-in templates prefill that form and do not persist a rule until submit. The keep-awake switch writes the `ui-automation.keepAwake` Host setting; a live Host then holds an OS sleep assertion and releases it when the switch turns off or the plugin unloads. The form does not parse natural language. Clicking the card body, not only the title, shows that rule's settings and history; settings save through `automation.update`. History lists `endedAt`, `source`, and can delete one past run through `automation.deleteRun`. A started run-now waits until the Host list carries the new Session, then closes the Automation page and opens that Session; a skipped or failed fire stays on the page. Each time the page opens it fetches the Host list once.

## Alternatives considered

**A Settings section.** The Host note named Settings as the later human surface. A Settings page would hide the collection behind another click and would not match the request to put Automation under New Session.

**A footer action next to Settings.** Footer actions are additive and sit at the bottom of the column. The request is a sibling of New Session.

**Fold the UI into ui-sidebar.** The shell owns geometry only. A Host-backed collection is a feature plugin, matching ui-jobs and ui-settings-models.

## Verification

Package tests cover slot registration and HMR disposal, store list/create/update/enable/run-now/delete and page visibility, run-count loading, the selected-rule settings and history panes, a started run-now waiting for the Session list then opening it, selector summaries, remaining-time chips, draft validation, keep-awake preference and OS hold, template overlay, and the trigger plus center-column page. The Web e2e scenario creates an `after` rule through the real Host and asserts it on the page. Sidebar shell snapshots include the empty `sidebar.automation` hole.

## Consequences

Fired Sessions still appear in the ordinary list with `origin: 'automation'`. Run-now from the page also selects that Session; the list still hides a Session that has not started a turn. A stopped Host still does not fire. Model tools remain the only path that creates a rule from inside a live root turn.
