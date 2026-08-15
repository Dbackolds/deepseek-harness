# dsh-user-system-prompts

English | [中文](README.zh.md)

User-authored system-prompt library and per-model assembly. `UserSystemPrompts` provides `ctx.userSystemPrompts` and registers the `user-system-prompts` Settings section. The composition entry is empty; a mounted settings provider layers the user's library and bindings over it.

The settings page owns create, edit, delete, per-model multi-select, order, and override. This package applies the matching model's selected prompts after cooperative assembly and after any complete-section restore.

- `ctx.userSystemPrompts.current()` returns a detached `{ prompts, bindings }` snapshot.
- A binding with `override: false` appends its selected prompts, in listed order, after the assembled sections.
- A binding with `override: true` replaces those assembled sections. That replacement runs after a `complete` persona is restored, so a user override is the prompt the model receives.
- A request whose assembled `{{provider}}`/`{{model}}` pair has no binding, or an empty selection, leaves assembly unchanged.

Unknown prompt ids, duplicate ids, and duplicate model keys fail at the Settings write. Assembly treats a stored list as exact.

## Model Experience

### Selected user prompts

#### What the model sees

For a request whose assembled provider and model match a binding, the selected library texts appear as `user-system-prompt:<id>` sections in listed order. Append mode keeps every earlier section and adds these after it. Override mode makes these sections the whole system prompt.

#### Token effect

Selected texts repeat on every request for that model. Override mode removes every other system-prompt token for those requests.

#### KV Cache effect

Prefix-stable while the library texts, listed order, override flag, and earlier assembled sections stay identical. Editing a selected prompt, changing order, toggling override, or switching the session's model may invalidate reuse from the first changed system-prompt token.

## Known Limitations and Deferred Work

- Bindings key on provider route plus model id, not on a session. Every session that assembles that pair receives the same selection.
- The shipped loop registers `{{provider}}` and `{{model}}`; an assembly without those variables cannot match a binding.
