# Agent Note: Desktop title bar drag needs a real hit box

Status: implemented

English | [中文](2026-08-19-desktop-titlebar-drag-hitbox.zh.md)

## Problem

The frameless window moves only where Chromium registers `-webkit-app-region: drag`. After the product-name label left the reserved strip, that region was an empty flex child. An empty flex item has no hit box, so the pointer never started a window drag. The same rule was also appended from a page `<style>` after `did-finish-load`; Chromium does not register a late page-authored drag region.

## Decision

`titlebarStyles` paints `.dsh-desktop-drag` as an absolutely positioned block with an explicit height and platform insets: 70px from the left on macOS for the traffic lights, 138px from the right on Windows for the caption overlay. `attachTitlebar` installs those styles with `webContents.insertCSS` on `dom-ready` and injects only the markup on `did-finish-load`. The loading page still embeds the styles in its own document. Native-control insets stay in [the macOS chrome note](../feature/2026-08-15-desktop-macos-chrome.md); the empty reserved strip stays in [the omitted product-name note](../simplification/2026-08-16-desktop-titlebar-omits-product-name.md).

## Alternatives considered

**Keep the empty flex child and restore a hidden label solely to give it size.** Rejected: a zero-opacity label is still title-bar copy, and the omitted-name note already forbids that.

**Call `BrowserWindow.setMovable` or start a drag from a mousedown IPC.** Rejected: `setMovable` does not replace a missing `-webkit-app-region` on a frameless window, and a custom drag loop would own pointer capture the Web GUI already uses.

**Leave styles in the injected page `<style>`.** Rejected: a post-load page stylesheet does not register the drag region. `insertCSS` is the Electron path that does.

## Consequences

Dragging the reserved strip moves the window. Native traffic lights and the Windows caption overlay stay outside the drag box because the insets shrink the box rather than pad inside a full-width box. Double-click maximize still binds to the drag node.

## Testing

`apps/desktop/tests/titlebar.spec.ts` asserts both variants emit an absolute drag box, the platform insets, and `-webkit-app-region: drag`, and that `titlebarInjectScript` no longer embeds the stylesheet.
