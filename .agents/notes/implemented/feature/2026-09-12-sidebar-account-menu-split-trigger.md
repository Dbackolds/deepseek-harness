# Agent Note: Sidebar account menu split trigger

Status: implemented

English | [中文](2026-09-12-sidebar-account-menu-split-trigger.zh.md)

## Problem

The sidebar foot account bar was a single Settings button. Clicking the account chip and clicking the trailing gear both opened the Settings modal, so there was no way to open a compact account menu the way comparable products do.

## Decision

In the wide sidebar column, `SettingsRoot` splits the foot into two sibling buttons. The left button is an account menu (interface language, appearance, interface scale) anchored above the chip. Language offers System default plus the shipped locales; appearance is System default, Dark theme, Light theme; scale is Zoom in / Zoom out / Actual size against the conversation font-size range. The right button is the Settings glyph and keeps the localized Settings accessible name. Overlay hit targets are not used: each button receives its own pointer events. The collapsed rail stays a single circular chip that opens Settings.

The menu writes through injected `setLocale` / `clearLocale` / `setTheme` / `setFontSize` callbacks and reads locale plus theme snapshots from the shell inject hooks. `LocaleSnapshot.preference` distinguishes an explicit pick from the browser-derived locale so System default can show a check. Submenu parents show a trailing chevron; selected submenu rows show a check. There is no disconnect command because Connection exposes reconnect, not a user-initiated disconnect.

## Alternatives considered

**Keep one button and open the menu from a long-press or right-click.** Rejected: the request is two independent click targets, matching the visual split already drawn on the bar.

**Put language, theme, and scale only in the Settings modal.** Rejected: that leaves the left chip with no action other than opening the same modal as the gear.

**Add a Host disconnect RPC for the menu's Disconnect row.** Rejected: Connection has no user-initiated disconnect; a dead row would be product-visible and false.

## Consequences

- Wide-column Settings e2e callers that click the Settings accessible name still open the modal.
- The account menu is absent from the collapsed rail.
- The settings shell now injects the theme service in addition to locale and connection.

## Testing

`ui-settings-general` component tests click the Account menu without opening the dialog, then apply language, appearance, and scale submenu choices. Rail tests keep the Account menu off the collapsed chip. `ui-primitives` Menu tests cover the submenu chevron.
