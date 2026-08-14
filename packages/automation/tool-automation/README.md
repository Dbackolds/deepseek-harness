# @deepseek-ai/dsh-tool-automation

English | [中文](README.zh.md)

The model-facing Consumer for [`ctx.automation`](../automation/README.md): `automation_list`, `automation_create`, `automation_update`, `automation_delete`, and `automation_set_enabled`.

## Tools

- `automation_list()` returns every rule with `state` and `nextAt`.
- `automation_create(...)` requires a non-empty `task` and exactly one selector. Omitted `workspace_id` uses the current session workspace. Omitted `permission_preset` keeps the user default; unattended writes must name `danger-full-access`. `on_overlap` defaults to `skip`.
- `automation_update(id, ...)` applies a sparse patch. Changing the schedule still requires exactly one selector field.
- `automation_delete(id)` removes the rule and keeps run history.
- `automation_set_enabled(id, enabled)` arms or disarms without rewriting the selector.

All five calls are exclusive. UI clients receive generic cards.

## Authority

Mutations require the exact live root Agent, an open turn, and a `{ kind: 'user' }` message in that turn. `Agent.followup()` and plugin fires that omit a source inherit `user`, so Automation itself must pass `{ kind: 'plugin', plugin: 'automation' }`. Subagents do not receive these tools.

## Model Experience

### Scoped management tools

#### What the model sees

Root Agents created after this plugin loads see the five generated schemas. Results are canonical JSON of the service views.

#### Token effect

The schemas add a fixed request prefix while the plugin is installed. Each call adds its JSON result through the ordinary tool-result pipeline.

#### KV Cache effect

The schemas stay prefix-stable while their definitions stay unchanged. Calls append to later history.

## Known Limitations and Deferred Work

- **No `automation_run_now` tool** — manual fire stays on the Host RPC / Settings path so a model cannot start a second Session from inside a conversation without a schedule.
