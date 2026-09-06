# @deepseek-ai/dsh-client-ui-session-history-gate

English | [中文](README.zh.md)

## Summary

General settings row gating the model-facing session-history tools. The Host gate, its settings schema, and the tool restrictions live on the host-side `@deepseek-ai/dsh-session-history-gate` plugin (`packages/session-query/session-history-gate`); this package only binds that plugin's `session-history-tools` namespace into `settings.general.item`.

The row is one checkbox over a `SettingsScope` mirror: it renders the accepted section, writes optimistically, and reverts to the Host value when a write does not land. While the namespace is not exposed or the document is read-only, the checkbox stays disabled — the same fail-closed posture as the Host gate. No `./invariant` is published: the package owns no independent runtime relationship beyond what the Host gate already registers.

## Table of Contents

- [Summary](#summary)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The row owns no host registration; the namespace schema and its live semantics belong to the Host gate plugin. Keep the write path on `scope.set` with the optimistic-then-adopt sequence — the controller reverts through `adopt()`, never through an error banner.

</details>

## Model Experience

Indirectly, through the Host gate: while the toggle is off, agents see no `agent_session_*` / `session_search` tool schemas and a prompt section directs them to ask the user to enable the row when a task genuinely needs prior-conversation recall.

#### KV Cache effect

Toggling the row changes the tool schemas and prompt sections of the next model request in every live session; the row itself carries no conversation content.

## Known Limitations and Deferred Work

- One host-global toggle; there is no per-session or per-preset granularity (by spec).
