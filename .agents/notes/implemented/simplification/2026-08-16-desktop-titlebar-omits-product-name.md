# Agent Note: Desktop title bar omits the product name

Status: implemented

English | [中文](2026-08-16-desktop-titlebar-omits-product-name.zh.md)

## Problem

The frameless desktop chrome painted `DeepSeek Harness` in the reserved title-bar strip beside the native window controls. The Web GUI already names the product in its own header, so the injected label repeats that identity in a second chrome band and adds no window-control information.

## Decision

`titlebarMarkup` keeps the drag region and platform insets, and does not render a product-name label. The Electron window title, dock name, loading-page document title, and Start-menu shortcut still use `DeepSeek Harness` so the OS switcher and installer surfaces stay named.

## Alternatives considered

**Keep the label as the only title-bar content.** Rejected: it restates the Web header and crowds the traffic-light / caption-button strip.

**Replace the label with a session or workspace title.** Rejected: those values already live in the Web GUI; the desktop package does not own session state.

## Consequences

The reserved strip is an empty drag region plus native controls. Reintroducing title-bar copy needs a new product decision that supersedes this note.

## Testing

- `apps/desktop/tests/titlebar.spec.ts` asserts both platform markups keep the drag region and omit `DeepSeek Harness`.
