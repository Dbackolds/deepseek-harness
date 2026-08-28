# Agent Note: Automation cancelled wait resumes

Status: implemented

English | [中文](2026-08-29-automation-cancelled-wait-resumes.zh.md)

## Problem

A live Host can show every enabled rule as overdue and still open no Session. `requestDrive()` cancelled the current `setTimeout` so a shorter remaining target, an overlap idle, or a CRUD mutation could re-derive. `wait()` resolved only on that timeout or dispose, so the in-flight drive stayed parked on the cancelled wait. Later due instants never reached `fireDue`. A rejected `fireDue` also ended the whole drive, so a later due rule in the same batch never fired.

## Decision

`clearTimer()` resolves the wait it cancels. The drive loop then re-reads the wall clock and either fires due rules or arms the next bounded wait. A rejected `fireDue` is logged; later due rules in that batch still run. If any target remains due after that batch, the owner waits one minute before retrying.

## Alternatives considered

**Keep the wait promise and start a second drive beside it.** Rejected: two drives would race on the same rule table and could double-fire.

**Fault the runtime on a cancelled wait, like Schedule's corrupt-log path.** Rejected: cancelling a wait is the ordinary re-derive path after CRUD, overlap idle, and a successful fire. A permanent fault would freeze Host Automation until restart.

**Advance a still-due recurring target after a rejected fire.** Rejected: latest-only catch-up already skips missed intervals; advancing on failure would skip the current occurrence without opening a Session.

## Consequences

A Host that stays live through CRUD, overlap skip, or a failed open keeps firing later due rules. A still-due target retries at most once per minute. A stopped Host still does no work.

## Testing

- `packages/automation/automation/tests/domain.spec.ts` fires a later-created sooner rule after `requestDrive` cancelled the first wait, and fires a healthy later rule after the earlier `fireDue` rejects.
