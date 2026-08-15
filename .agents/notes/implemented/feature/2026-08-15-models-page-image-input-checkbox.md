# Agent Note: Models page image-input checkbox

Status: implemented

English | [中文](2026-08-15-models-page-image-input-checkbox.zh.md)

## Problem

A model entered by hand is treated as text-only until it declares otherwise, because nothing can ask an endpoint which modalities it accepts. Attaching an image to such a model is refused before it is sent, naming the model. The Models page already edits a pi-ai profile's `models` array, but it had no control for `input`. Declaring a vision model therefore meant opening `$DSH_HOME/settings.yaml` and knowing that field exists. Users who configured a vision model through the form — FAC, a custom gateway, a fetched catalog id — met the toast and had no on-page way to correct it.

## Decision

Each pi-ai model row carries a **Supports images** checkbox on the identifying line, next to the id and display name. Checking it writes `input: [text, image]` for that model. Unchecking drops the field rather than storing `[text]`: absence keeps the installed catalog entry, then the route's `defaultInput`, so a catalog vision model stays visual until the row itself claims otherwise. The checkbox is a claim about the endpoint, not a check of it; a model that declares images its endpoint does not serve is still refused by the provider.

The control stays off DeepSeek's catalog editor. DeepSeek's own chat-completions route is text-only and cannot be configured otherwise.

The field stays on the row rather than behind the Capacities disclosure. A hand-declared vision model is unusable until this is set; hiding it behind capacities would leave the toast as the only way to discover the field.

`$DSH_HOME/settings.yaml` still accepts the same `input` and `defaultInput` lists. The form writes only the per-model claim; a route-wide fallback and a catalog-model narrowing through `modelOverrides` remain YAML.

## Alternatives considered

**Put the checkbox behind the Capacities disclosure.** The row would stay one line of identity. Rejected: a hand-declared vision model is unusable until the field is set, and the disclosure is labelled Capacities, so a user chasing the toast would not open it.

**Add a route-level "every model takes images" checkbox that writes `defaultInput`.** One click for a vision-only gateway. Rejected: `defaultInput` is a fallback, not an override, and a catalog route that set it would not strip images from catalog models that have them, nor add them to catalog models that already declare text only. The per-model claim is the one a hand-declared row actually needs.

**Write `[text]` when the box is unchecked.** Symmetric with the checked value. Rejected: that would strip images from a catalog model whose gateway already serves them, which is the opposite of leaving the field absent.

**Offer the checkbox on DeepSeek rows as well.** One editor contract. Rejected: DeepSeek's chat-completions adapter refuses image content and cannot be configured otherwise, so the box would write a claim the adapter then rejects.

## Consequences

A vision model on FAC or a custom provider can be declared without leaving the browser. The cost is one more control on every pi-ai row, and a checked box that the endpoint does not actually serve still fails mid-turn at the provider.

## Testing

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` writes `input: [text, image]` from the checkbox and drops the field when it is unchecked. The fetch-picker cases query checkboxes inside the dialog so they do not collide with the row control. `apps/web/tests/models-settings.e2e.ts` checks the box while declaring a route and asserts the stored `input` list; the declared-edit snapshot includes the checked control.
