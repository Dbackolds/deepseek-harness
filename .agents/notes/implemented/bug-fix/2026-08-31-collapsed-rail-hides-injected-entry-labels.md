# Agent Note: Collapsed rail hides injected entry labels

Status: implemented

English | [中文](2026-08-31-collapsed-rail-hides-injected-entry-labels.zh.md)

## Problem

Third-party New Session siblings such as `dsh-mnemon` inject a button with an icon span and a text label. On the 56px rail the shell already shrinks that button to 36px with `overflow: hidden`. The plugins hide the label only under `[data-dsh-frame][data-sidebar-collapsed]`, an attribute the layout frame never published. The leftover caption then clipped to a one-character mark — for Chinese `记忆系统`, the visible remnant was `目`.

## Decision

`AppFrame` always sets empty `data-dsh-frame` on the three-column root and keeps `data-sidebar-collapsed` when the compact rail is showing. Injected siblings can keep using that pair as their public collapsed hook without reading hashed sidebar classes.

The sidebar shell also hides known injected labels on the rail (`span:last-child` and `[class*="entryLabel"]`) and sizes their SVG to the same 18px glyph as New Session, add, and search, so a plugin that still misses the frame attributes cannot clip caption text into the icon box.

## Alternatives considered

**Patch only the installed `dsh-mnemon` bundle.** Rejected because the host upgrades that plugin and because SSH / taskboard entries share the same injection pattern.

**Rely on the existing last-child `display: none` rule alone.** Rejected because the plugins' own `[data-dsh-frame]` rules never matched, and a class-based label is a more stable hide target than child index if the injection grows extra nodes.

**Ask plugins to read hashed `.collapsed`.** Rejected because CSS-module hashes are not a cross-package contract.

## Consequences

- `dsh-mnemon` 0.2.x collapsed CSS starts hiding `记忆系统` / "Memory system" without a plugin rebuild.
- The rail glyph for known injected siblings is 18px, matching the official 36px controls.
- Layout tests pin `data-dsh-frame`; sidebar style tests pin the rail label hide and glyph size.
