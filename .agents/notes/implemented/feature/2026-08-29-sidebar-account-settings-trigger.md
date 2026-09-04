# Agent Note: Sidebar account settings trigger

Status: implemented

English | [中文](2026-08-29-sidebar-account-settings-trigger.zh.md)

## Problem

The sidebar foot was a full-width Settings row: a gear glyph plus the word Settings. That reads as a settings page entry, not as the local account that owns the Host. Product comparison with ZCode's account chip (initial, username, trailing settings glyph) made the mismatch visible.

## Decision

`ui-settings-general`'s `settings.trigger` occupant is an account chip. The visual name is the last path segment of the connection generation's Host `home` (POSIX or Windows), or the localized Local / 本地 fallback when home is missing. The wide column shows that name and a trailing settings glyph; the collapsed rail shows only the circular initial. The localized Settings string stays in the tree and is visually hidden, so the Settings click target's accessible name remains Settings / 设置 and existing `getByRole('button', { name: '设置', exact: true })` callers keep working. The account name is `aria-hidden`. The trigger injects `connection.generation` the same way Tool and Workspace do. The wide column later splits the chip and glyph into separate click targets; see `2026-09-12-sidebar-account-menu-split-trigger.md`.

This is not a login. The connection generation still publishes only the account home path; the chip derives a display username from that path and does not add a username field to the wire.

## Alternatives considered

**An out-of-tree plugin replacing `settings.trigger`.** Rejected: the foot is shipped chrome, not an additive footer action, and every Web install would need the plugin to match the requested product chrome.

**Putting the chip in `sidebar.footer.action` next to Settings.** Rejected: that would keep the Settings row and add a second foot control.

**Adding `username` to the generation Host facts.** Rejected: the home path already names the local account, and a new wire field is not needed for display.

## Consequences

- Wide trigger copy is the account name; Settings remains the accessible name only.
- Rail trigger is the initial chip, not a gear.
- Fixture and real Hosts that publish `home` show that path's last segment; a missing description shows Local / 本地.

## Testing

Package tests cover POSIX and Windows home parsing, the wide chip plus hidden Settings name, the rail chip without a visible name, and trigger inject of `connection.generation`. Web lifecycle-chrome snapshots keep the Settings accessible name and omit the now-hidden settings glyph.
