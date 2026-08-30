# Agent Note: Windows reveal menu uses File Explorer wording

Status: implemented

English | [中文](2026-08-30-windows-reveal-explorer-label.zh.md)

## Problem

The Session context menu label for revealing a Host path used macOS Finder wording in both product locales: Chinese `在 Finder 中打开` and English `Reveal in Finder`. On a Windows Host that action opens File Explorer, so the Finder name is the wrong desktop app.

## Decision

`packages/client/ui-workspace` keeps the locale key `menu.revealInFinder` and changes only the visible strings:

- Chinese: `在资源管理器打开`
- English: `Reveal in File Explorer`

The package README pair documents the same menu wording. The row action id and `onReveal` / `openPath` wiring stay unchanged.

## Alternatives considered

- **Add Host-platform-specific locale keys and switch the label from `host.describe`.** Correct for mixed Host fleets, but this change only needed Windows-facing product copy in the current GUI, and `host.describe` still exposes `canOpenPath` rather than a desktop-app name.
- **Rename the locale key away from Finder.** Would churn every consumer of `menu.revealInFinder` for no behavior change; the key remains an internal identifier.
- **Leave Finder wording as a generic "reveal" metaphor.** The menu names a real desktop app; on Windows that app is File Explorer / 资源管理器.

## Consequences

Windows users see the local file-manager name. macOS and Linux builds that reuse the same dictionaries also show File Explorer wording until a later Host-aware label lands. Reveal behavior is unchanged.

## Testing

`packages/client/ui-workspace/tests/rows.client.spec.tsx` clicks the Chinese menu item `在资源管理器打开` and still asserts `onReveal` receives the Session cwd.