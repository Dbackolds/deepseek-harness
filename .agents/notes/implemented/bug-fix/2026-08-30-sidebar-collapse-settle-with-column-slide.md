# Agent Note: Sidebar collapse settles with the column slide

Status: implemented

English | [中文](2026-08-30-sidebar-collapse-settle-with-column-slide.zh.md)

## Problem

Live sidebar collapse felt hitchy. The shell faded wide content for 150ms and then snapped the rail layout while AppFrame's grid track was still easing for the remaining half of its 300ms slide. Expand remounted wide content with a shorter 200ms fade, so the session list arrived after the column had already opened.

## Decision

`SidebarRoot` keeps the frozen wide tree mounted until the AppFrame column slide finishes (`COLLAPSE_SETTLE_MS = 300`, matching `--ds-transition-duration-slow`). The 150ms opacity fade still runs at the start of collapse; the rail layout and shared `rail-in` / `rail-fade-in` entry begin only after that settle. Expand remounts wide content, including the workspace browser's mirrored `.wide` rule, with a 300ms fade so the open track and content share one timeline. Cold collapsed renders stay static, and reduced-motion still disables both transitions.

## Alternatives considered

**Keep the 150ms settle and only soften the rail-in fill mode.** Rejected because the hitch is the mid-slide unmount and layout snap, not the animation fill alone.

**Lengthen the fade to 300ms and keep the early settle.** Rejected because that would leave faded-out wide chrome mounted only to be replaced immediately, without removing the mid-slide snap.

**Drive settle from a `transitionend` on the frame track.** Rejected for this fix: the shell already owns a timer keyed to the published slow duration, and AppFrame already clears `data-sidebar-motion` on the same 320ms budget. A DOM event bridge would couple packages without changing the visible timing.

## Consequences

- Collapse no longer swaps to the rail while the column is still moving.
- Expand fade matches the column slide instead of trailing it.
- Style and shell tests pin the shared rail animation fill, the 300ms settle boundary, and the README timing prose.
