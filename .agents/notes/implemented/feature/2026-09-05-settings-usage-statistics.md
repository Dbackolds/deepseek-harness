# Agent Note: Settings usage statistics page

English | [中文](2026-09-05-settings-usage-statistics.zh.md)

Status: implemented

## Problem

The Web Settings shell had no Host-wide view of provider-reported tokens, chat duration, or model share. Session-local `tokenUsage` and `sessionStats` projections already exist, but they do not answer calendar activity, streaks, or cross-session totals.

## Decision

Add a `sessionUsage` projection unit beside `sessionStats`, a Host `usage.overview` Remote that inspects every visible Session without activating Agents, and a Settings section that charts that snapshot.

Calendar rows stay UTC in the fold. The Remote rebases each UTC day onto the local day that contains that UTC midnight, using the browser IANA zone. Token totals reuse the four-bucket `tokenUsage` sum. Duration reuses assembled-message model wall time. Streaks count local calendar days with any recorded activity.

The page is local application usage only. A personal-plan tab is not part of this decision.

## Alternatives considered

- **Client-side aggregation of `session.list` projection hints.** Cold list rows omit `sessionUsage` unless a small-blank probe already observed the Session, so the page would undercount.
- **Scanning raw logs in the browser.** That work belongs on the Host observation path that already restores cold Sessions.
- **Per-day durable Host storage.** The fold is O(1) plus one row per active UTC day; replaying logs through the existing observation cache is enough.

## Consequences

Opening Usage observes every visible Session. Large Hosts pay that cost on each mount or retry. Missing, corrupt, or otherwise unreadable Sessions contribute empty usage rather than failing the page.

## Required verification

- `packages/session/session-stats/tests/usage.spec.ts` covers the fold, UTC days, in-step replacement, timezone rebase, and streaks.
- `packages/api/session-controller/tests/session-usage.host.spec.ts` covers invalid zones, cross-session totals, missing Sessions, and unreadable Sessions.
- `packages/client/ui-settings-usage/tests/` covers formatters, empty/error/retry UI, and Settings slot registration.
