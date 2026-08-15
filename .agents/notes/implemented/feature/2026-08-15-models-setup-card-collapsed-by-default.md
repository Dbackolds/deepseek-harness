# Agent Note: Models setup cards collapse by default

Status: implemented

English | [中文](2026-08-15-models-setup-card-collapsed-by-default.zh.md)

## Problem

First-run Models setup cards for composition-owned providers such as DeepSeek and FAC opened their full API-key forms as soon as Settings → Models loaded. Two cards plus the add actions filled the panel before the user chose a provider, and a user who only needed one key still had to look past the other form.

## Decision

A first-run setup card is still that provider's presence on the page until Cancel or a successful Apply turns it into a row. Its form starts collapsed. The card title is a native `<details>` / `<summary>` disclosure: expanding it reveals the same `ProviderEditor` the open card used, and collapsing it leaves that editor mounted so a typed key survives. The disclosure owns the title; the editor hides its own. Cancel and Apply stay inside the expanded body.

Ordinary rows, the add card, and the custom-provider card are unchanged. Closing a setup card still dismisses only that card.

## Alternatives considered

**Reuse the row Edit control and drop the setup-card posture.** Rejected because first-run still needs the card to be the provider's presence until the user dismisses it; collapsing the form keeps that posture without forcing the key field onto the page.

**Unmount the editor while collapsed.** Rejected because a typed key would disappear when the user collapsed the card to compare providers.

**Start the first setup card open and the rest collapsed.** Rejected because the page cannot know which composition-owned provider the user intends to configure.

## Consequences

Opening Models on a keyless first-run profile shows DeepSeek and FAC as titled, collapsed cards. Expanding a title is the only way to reach that card's key field. A collapsed draft remains until Cancel, Apply, or leaving the page.

## Testing

Package tests pin the collapsed first-run render, draft survival across collapse, write-only key storage after expand, and Cancel still dismissing only that card. The Models empty ARIA snapshot pins the collapsed FAC card beside the add flow. The usable-provider e2e expands FAC before exercising Cancel beside an open add card.
