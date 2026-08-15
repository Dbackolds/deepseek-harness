# Agent Note: User system-prompt library and per-model assembly

Status: implemented

English | [中文](2026-08-15-user-system-prompts.zh.md)

## Problem

The system-prompt registry is plugin-authored. A user who wants reusable prompt texts, then a different ordered selection per model — including replacing the assembled prompt — has no Settings page and no Host owner for that library. Editing `persona` in composition or a preset's `dsh-persona` row cannot express multi-select, order, or a per-model override that survives a `complete` persona restore.

## Decision

`dsh-user-system-prompts` owns the `user-system-prompts` Settings section: a library of `{ id, name, text }` prompts, per-model bindings of `{ provider, model, promptIds, override }`, and `{ name, text }` replacements of registered plugin sections. `dsh-client-ui-settings-system-prompts` registers the System prompts settings page after Agent presets. Writes go through `settings.replace`. The page lists registered sections through `systemPrompt.list`, which reads `ctx.systemPrompt.listSections()` — the registry view, not a full assembly. Assembly first applies stored section replacements, then the matching model's selected texts, through `ctx.systemPrompt.afterAssemble()`, which runs after the cooperative waterfall and after an effective complete section is restored.

`afterAssemble` lives on `dsh-system-prompt` because a `system-prompt/assemble` listener cannot replace a `complete` section: the registry restores that section after the waterfall. A user override that is meant to be the prompt the model receives has to run after that restore.

Bindings key on the assembled `{{provider}}`/`{{model}}` variables the shipped loop already registers. An assembly without those variables, or without a binding, is left unchanged. Unknown ids and duplicate keys fail at the Settings write.

## Alternatives considered

- **Register ordinary `systemPrompt.section()` rows and mutate them on settings change** — cannot replace a `complete` preset persona, and a live section whose text changes mid-session still needs the same after-restore hook to override.
- **Put the library on `dsh-system-prompt` Config** — that plugin owns deployment persona and tool order, not an end-user catalog. A second Settings-backed owner keeps the registry's contract unchanged.
- **One free-text field per model** — loses reuse across models and makes order and multi-select unrepresentable.
- **Override per selected prompt rather than per model** — a mixed append/replace list has no defined composition once a `complete` section is in play; one flag per model is the whole policy.

## Consequences

- The Settings nav gains a System prompts row. The page is the only product editor for the library, registered-section replacements, and bindings.
- A model with `override: true` receives only the selected library texts, even when a preset mounted a complete persona.
- Changing the library or a binding takes effect on the next assembled step of any session whose assembled provider/model pair matches.
- ApiProxy must expose `user-system-prompts` or the page cannot persist.

## Testing

Host tests cover append, override after a complete section, registered-section replacement, empty-library no-op, and write-time validation. Client tests cover registration, create/replace writes, shipped-section edit and restore, delete cascading out of bindings, and the section's add/reorder/override gestures. ApiProxy serves the namespace and `systemPrompt.list`. Web snapshots include the new nav row.
