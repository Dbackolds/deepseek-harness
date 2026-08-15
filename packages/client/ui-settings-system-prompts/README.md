# dsh-client-ui-settings-system-prompts

English | [中文](README.zh.md)

The **System prompts** settings section. The page owns the user library and the per-model assembly: create, edit, and delete reusable prompts, then choose which ones each catalog model uses, in which order, and whether they replace the assembled prompt.

Writes go through `settings.replace` on the `user-system-prompts` namespace. The Host plugin [`dsh-user-system-prompts`](../../core/user-system-prompts/README.md) applies the stored selection at the next assembled step.

The nav row sits after Agent presets (`order: 25`). A deployment that does not expose the namespace renders the unavailable line rather than an editor.

## Model Experience

None, as the section renders a browser configuration UI; the values it writes reach a model only through `dsh-user-system-prompts`.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The model list is the host catalog** — a route that is configured but whose listing failed appears only in the catalog-error line, not as an assemblable card.
- **Override is per model, not per prompt** — every selected text for that model either appends or replaces the assembled prompt together.
