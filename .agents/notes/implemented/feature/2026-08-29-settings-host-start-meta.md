# Agent Note: Settings Host start time and start count

Status: implemented

English | [中文](2026-08-29-settings-host-start-meta.zh.md)

## Problem

The Settings content-column header left a blank stretch beside the title. Operators diagnosing a live Host, including why Automation stayed overdue, could not see when this process started or how many times this home had started a Host.

## Decision

The Host half of `ui-settings-general` registers `ui-host` with a durable `startCount` and the current process `startedAt` UTC instant. The first settings registration in a Node process increments `startCount` once and writes that process's start instant; later registrations in the same process refresh `startedAt` without incrementing. The settings content header shows both facts after the section is ready.

## Alternatives considered

**Put the facts on `ConnectionHostInfo`.** Rejected: the opening frame already carries only `home`, and a start count must survive reconnects and process restarts in the user-settings document.

**Register the meta as a `settings.action`.** Rejected: that list is `margin-left: auto` and would sit with Open configuration file on the right, not in the blank header stretch.

## Consequences

`settings.yaml` gains a `ui-host` section. A Host that never loads this plugin records nothing. Snapshot goldens that capture the settings dialog include the localized meta line.

## Testing

- `packages/client/ui-settings-general/tests/host.client.spec.ts` increments once per process.
- `packages/client/ui-settings-general/tests/host-start-meta.client.spec.ts` and component/root specs cover hidden and ready states.
