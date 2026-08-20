# Agent Note: Web chat shows an always-visible trailing message clock

Status: implemented

English | [中文](2026-08-20-web-always-visible-message-clock.zh.md)

## Problem

The Web chat already stores each message's event time, but the clock lives inside the IconActions row and fades in only on hover. A reader scanning the transcript cannot tell when a turn happened without pointing at every row, which is the opposite of the Grok TUI pattern of a muted clock sitting at the trailing edge of each message.

## Decision

Every user, steering, and assistant message row renders its event clock as an always-visible `<time>` label. `MessageClock` formats `node.time` through `formatMessageClock` and sits on the message band itself: a right-aligned user/steering bubble keeps the clock immediately to the left of the bubble, and assistant narration keeps it to the right of the markdown body. Same calendar day prints `h:mm` plus a locale meridiem (`上午` / `下午`, `AM` / `PM`); earlier this year prefixes the `clock.md` date template; other years prefix `clock.ymd`. `useCalendarDay` still widens the label after local midnight. Pending steering has no durable event time, so it mounts no clock.

The IconActions row no longer owns the clock. Settled-turn metrics (`Ran for`, TTFT, tok/s) stay on that row and remain visible when present. Copy and branch stay always-visible icon controls.

## Alternatives considered

**Keep hover-revealed clocks on the IconActions row and only restyle them.** Rejected: the request is the Grok TUI scan pattern — a clock you can read without hovering — and a footer clock still sits away from the message body.

**Switch the existing 24-hour `HH:mm` string to 12-hour without moving the label.** Rejected: the missing affordance is placement and visibility, not only the numerals. The 12-hour form is part of matching that TUI, not a substitute for moving the clock onto the row.

**Show a live wall-clock that ticks independently of message events.** Rejected: the transcript clock is the logged event time. A free-running "now" label would disagree with replay, paging, and the midnight widen already owned by `useCalendarDay`.

## Consequences

Message arrival time is readable at rest on every durable user and assistant row. Hover no longer gates the clock, so the time competes with content the way the TUI does. Assistant metrics remain on the turn-tail actions row and are no longer glued to a hidden clock. Web aria goldens still collapse every clock shape to `{{clock}}`; the normalizer accepts the 12-hour form with a locale meridiem.
