# Agent Note: Desktop title bar pads only body

Status: implemented

English | [中文](2026-08-15-desktop-titlebar-double-padding.zh.md)

## Problem

The Electron shell injects a 36px fixed title bar. Padding both `html` and `body` by that height stacks two gaps: the Web GUI already sets `html, body, #root { height: 100% }` with `box-sizing: border-box`, so the fixed bar covers the first 36px and the second 36px paints as an empty strip of `body`'s `--dsw-alias-bg-base` (white in light theme) between the dark title bar and the app frame.

## Decision

`titlebarStyles` pads only `body`. The Web GUI's height chain then sizes `#root` to the body's content box under one reserved strip, and the fixed bar covers that padding. Platform variants, overlay width, and traffic-light inset stay in [the macOS chrome note](../feature/2026-08-15-desktop-macos-chrome.md).

## Alternatives considered

**Pad `html` instead of `body`.** Rejected. `body` is the element whose background and `#root` percentage height already describe the app canvas; padding `html` leaves a gap whose background is not the title bar.

**Give `#root` its own `padding-top` or `height: calc(100% - 36px)` in the Web GUI.** Rejected. The desktop shell owns the reserved strip. The Web GUI stays a full-height document in the browser.

**Paint the extra strip the title-bar color.** Rejected. That hides the stacked gap instead of removing it, and still shortens the app frame by 36px.

## Consequences

Light-theme desktop no longer shows a blank band under the title bar. The loading page still sizes its centered hint with `calc(100vh - var(--dsh-desktop-titlebar))` against a single body padding.

## Testing

`apps/desktop/tests/titlebar.spec.ts` asserts the injected rule is `body { padding-top: … }` and rejects an `html, body` padding selector.
