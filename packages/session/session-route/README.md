# @deepseek-ai/dsh-session-route

English | [中文](README.zh.md)

Function plugin registering the `requestRoute` projection unit: the latest-wins fold of `request/header` events over the whole session log into the dispatched request route — provider, model, and optional reasoning effort — served through the session-projection seam (registry snapshot, change feed, and every projection carrier: history tail page, `session/projection` push frames, session list rows). Clients read which model a session actually runs — a whole-log fact that paging and compaction cannot change and that never consults the composer selector state; the reference consumers are the web chat's header identity label and per-step model lines.

## Fold semantics

- The latest `request/header` wins. Snapshots are whole values: the agent loop appends one inside the step before a dispatch whose header differs from the held one, plus the first dispatch of each loop instance, so replay order alone decides the value — the same latest-wins rule `foldRequestHeader` (dsh-session) applies over the same events.
- Only the identity triple is kept — `provider`, `model`, `reasoningEffort` from the header's `config`. System prompt, tool schemas, and adapter-default markers are dropped: the unit answers "which route", never "what was sent". `reasoningEffort` is absent from the value when the header carried none.
- `reason` — `'initial'`, `'resume'`, `'change'` — never changes what is served.
- The value is `null` before the log's first request header (the same no-value convention the `title` and `goal` units use). A composed registry always serves the key, so clients read the value, never key presence.
- A route equal to the folded one (a process resume re-logging the identical header) returns the same state reference, so the change feed stays silent; Object.is gates downstream work.

## Composition

```yaml
- id: session-route
  name: '@deepseek-ai/dsh-session-route'
```

Injects `sessionProjections` — the plugin's whole purpose; in assemblies without the registry the fiber stays pending and nothing registers.

## Model Experience

None, as the plugin only folds already-logged request headers into a client-facing read model and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Route identity, not served-provenance** — the value is the latest logged request header, not a per-response record of which adapter actually served a message; a provider-side reroute invisible to the log is not reflected here (per-message `assistant/message.source` provenance is that record).
- **Whole-log last-wins, not per-turn history** — a header is never un-logged, so after a mid-session switch the value names the new route for the whole session; resolving which route served one earlier step is the consumer's step-keyed join (the trajectory `headerFor` pattern), not this unit's.
- **Raw ids, no display names** — `provider` and `model` are the logged ids verbatim; catalog display-name and effort-label resolution is the consumer's directory lookup.
- **Mounted only in the web-app bundle** — other assemblies serve no `requestRoute` key, and their consumers fall back to their own derivations.
