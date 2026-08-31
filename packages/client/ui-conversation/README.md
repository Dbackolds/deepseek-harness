---
description: "Target-neutral conversation assembly and browser shell: event and view registries, per-session bindings, input state, slots, and temporary composer takeovers."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-conversation

English | [中文](README.zh.md)

## Summary

`ui-conversation` owns target-neutral Conversation assembly and the shared browser shell. It consumes Session Controller `SessionEventLikeEntry` feeds, exposes React-free registries and per-Session bindings through `ctx.uiConversation`, and contributes the `useConversation`, `useInput`, and `inputActions` standard props through `ctx.uiSession`. It also owns the per-session durable image URL cache: `ctx.uiConversation.imageUrl(sessionId, attachment)` resolves one session-authorized browser URL per attachment and revokes it with the Session binding, so every Conversation target shares one `session.attachment` read. Concrete targets such as Chat are separate packages that register their own Definitions, snapshot builders, Views, and renderers.

## Table of Contents

- [Conversation assembly](#conversation-assembly)
- [Shell and standard props](#shell-and-standard-props)
- [Temporary composer entries](#temporary-composer-entries)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="conversation-assembly"></a>
## Conversation assembly

`UiConversation.events` is the single registry for event Definitions, and `UiConversation.views` is the single registry for target snapshot builders. Both registries reject duplicate keys, preserve registration order, return idempotent disposers, and rebuild existing bindings when their contribution roster changes. `UiConversation.binding(bindingOrSessionId)` returns one identity-stable Conversation binding for the current Session Controller binding. It does not open another event source.

The adapter passes each `SessionEventLikeEntry` directly to the assembler. Its outer `type` distinguishes scalar and packed records, while its inner `event` always exposes `type`, `seq`, `time`, and `data`; Definitions receive that inner `SessionEventLike`. Historical replace and prepend accept both entry variants, while live append accepts only `SessionLiveEventEntry`. Every Definition uses the same `match` and `update` methods for both event forms, while `start` receives only a standard event and the assembler rejects a packed start. Definitions that do not consume Assistant deltas return `null` for the packed tags. Replacement windows and revision gaps rebuild from the complete loaded window; contiguous append and prepend revisions use incremental assembly without expanding packed members. The assembler owns Context matching, Turn/Step locations, target node materialization, target activity, and stable target sources. `ConversationSnapshot` contains only target-neutral views and active-target facts; Session lifecycle state remains in `SessionSnapshot`.

A target becomes active when shell selection resolves it or when its source receives a first subscriber. The assembler replaces that target from current Contexts once and keeps it active for later incremental flushes; creating a source does not activate it and unsubscription does not deactivate it.

Target packages declaration-merge their snapshot and Location data maps, then register with `ctx.uiConversation.events.register(...)` and `ctx.uiConversation.views.register(...)`. A target reads its Session-owned source with `ctx.uiConversation.binding(binding).target(targetId)`. Registrations are Cordis effects and their returned disposers remove the contribution from the same registry.

<a id="shell-and-standard-props"></a>
## Shell and standard props

The package registers the optional-Session `conversation` shell, strict Session header/body entries, View list, composer chain and bar, input regions, Hero regions, queue dock, draft persistence, and phase calculation. `ctx.uiSession.provide()` materializes the Conversation and input sources from the same Session binding and supplies `inputActions` as a stable standard prop.

View selection is deterministic: a registered persisted selection wins, otherwise registered `chat` wins, otherwise no View renders. It never chooses the first registered View. Shell phase combines Session lifecycle with the active-target set; no target-specific snapshot is read by the shell.

The shell reads the persisted View preference before rendering when a Session first binds or a cached Session becomes current, activates the registered preferred View or Chat fallback, and activates later tab or focus selections before committing them to the store. A blank Session still omits the `conversation.view` slot; no unselected target is activated.

The resident composer survives no-Session and Session transitions. The no-Session state keeps the same composer surface mounted but inert while the Workspace picker connects a blank Session. The surface is a shell-owned Lexical editor: reference chips are atomic decorator nodes carrying the owner's serialization identity (submission expands them through the owner codec), claimed slash commands stay styled leading text, folder text references carry the folder glyph as an icon prefix, and the draft's clipboard projection is mirrored into the per-Session Conversation store. Queue operations address exact queue occurrences through the scoped `ctx.conversation` service; queue previews render sent text through the shared inline reference projection from `ui-primitives` (wire session forms fold to their label) and show local image previews or durable image parts as thumbnails, while an edit exposes the literal sent text. Durable thumbnails resolve through the session image URL cache. Busy Enter behavior is stored in the Host-backed `ui-conversation` settings namespace.

Default sends commit optimistically: Enter clears the draft, occurrence table, and undo history in the same transaction, keeps the composer in `plain`, and runs the send as a detached attempt, so typing and further sends continue during the flight. `sendSession` registers a Session submission echo (`session.beginSubmission`) with the delivery mode before serializing; Session derives the placement from that mode and its current running state, so idle sends use the transcript, busy Queue sends use QueueDock, and busy Steer sends use the pending-steering surface. It then yields one paint and encodes images through the browser's native `FileReader` data-URL path. Concurrent failures are restored together in submission order until the user edits the restored content; command submissions keep the frozen `submitting` phase. Detached attempts retain their image ids through admission and Session scope disposal. When an echo retires as observed, the durable image cache exposes its preview immediately, fetches the admitted attachment, replaces the preview with the canonical URL, and revokes each URL after its use ends. Direct subagent continuations skip local echoes because their transport does not preserve the browser request id.

While a normal composer is running, its primary pointer action remains Stop when the draft is empty or input is unavailable. Actionable text or attachments switch the same seat to Queue Send; clearing or successfully submitting the draft restores Stop. The busy-Enter setting continues to select the Queue or Steer keyboard action. Continuable subagents keep separate Send and Stop actions ([decision](../../../.agents/notes/implemented/bug-fix/2026-08-20-running-draft-primary-send.md)).

<a id="temporary-composer-entries"></a>
## Temporary composer entries
`QueueDock` is the terminal input-dock entry at `order: 20`. It hides while empty, renders one pending row directly, and defaults two or more rows to a collapsed `"<n> 条排队消息"` header whose button expands or collapses the complete list. The header exposes `aria-expanded` and `aria-controls`; the expanded list scrolls within a 180px height bound. An active edit or mutation keeps its rows visible, and emptying the queue restores the collapsed default for the next queue. Each visible ordinary-session row remains a single-line preview with its exact-occurrence edit, delete, and strict-steer actions. Two or more ordinary-session rows are also HTML5-draggable: dropping a row on another row's top or bottom half sends `updateQueue({ kind: 'move', beforeItemId? })` for that exact occurrence, with no optimistic local reorder. Addressed subagents retain the rows as a read-only projection because their continuation transport does not expose queue mutation. If strict steer loses to a closed window, the original occurrence remains queued for normal delivery; if the driver already claimed it, normal delivery is already underway. Neither converged race displays a failure, while transport and unknown failures do.

`conversation.composer` is a generic chain. Its complete owner currency is:

```ts type-equiv
/** Owner values used to elect a composer takeover. */
interface ComposerChainProps {
  /** Current Session identity used by temporary business-owned entries. */
  sessionId: SessionId | undefined
  /** Current Session lifecycle state, absent without a selected Session. */
  session: SessionSnapshot | undefined
  /** Effective business-owned interaction awaiting the user in this Session. */
  pendingInteraction: SessionPendingInteraction | undefined
}
```

A business package may install one entry only while a Remote waterfall request is pending:

```tsx
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChainSelect, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

interface Request {
  readonly sessionId: SessionId
}

type RequestComposerProps =
  PropsRuntime<'conversation.composer'> & { matched: Request }
The chat stats line takes its token accounting from the generic token-meter `tokenUsage` projection read through the standard-kit `useProjection`: billed input is uncached input plus cache reads and writes; cache hit divides cache reads by that total. Every non-empty ratio starts with integer rounding. A non-full ratio adds decimal places only while the current precision would round to 100%, stopping at the minimum precision that remains below 100%; only a full cache hit displays 100%, and the precision has no fixed limit. The turn and step counts, the LLM and tool wall times, and the latency/throughput group all ride the whole-log `sessionStats` projection (host-folded from step boundaries, first-token chunks, tool pairs, and assembled messages), so paging and compaction cannot change any strip figure; an assembly without that unit falls back to the window fold over visible nodes, whose fields mirror the projection's. The strip averages each recorded step's TTFT and divides sampled output tokens by their summed decode spans into a latency/throughput group localized through the `conversation` locale namespace (`TTFT avg … · … tok/s` in English); a step missing a timing boundary or a usage sample drops out of those figures instead of skewing them, and durable count, token, and context groups remain visible when compaction leaves no assistant node in the loaded window. The turn-count, step-count, duration, cache, and token labels use the same namespace. Each settled turn additionally appends `TTFT {s}s · {tps} tok/s` labels to its assistant footer after the `Ran for` duration — the turn's first-step TTFT and its turn-aggregate decode throughput — gated on the turn's timing being in the loaded window (a contiguous log suffix, so an in-window turn carries every one of its steps) and omitting whichever figure is unrecorded. Durable user, steering, and assistant rows also paint an always-visible event clock (`h:mm` plus a locale meridiem, widening with date after midnight) on the message band itself: flush against the left edge of a user/steering bubble, and to the right of assistant narration ([decision](../../../.agents/notes/implemented/feature/2026-08-20-web-always-visible-message-clock.md)). A deployment without token-meter drops the token groups; when the line overflows, it elides with an ellipsis and a delayed hover tooltip carries the full text only while actually clipped. Context occupancy renders as the composer's trailing ContextMeter: a 14px occupancy ring after the model seat, fed by `contextPressure` and rendered only once both a numerator and a route capacity are known, that click-opens a panel pairing the `percent used` header and `~used / capacity` figures with a color-segmented bar and `~`-prefixed heuristic composition rows (system prompt, tools, messages) from the `contextBreakdown` projection. The ring and header read `projectedTokens` — the provider sample carried forward over the surface's movement since — so a compaction registers immediately instead of after a further turn; the composition rows stay wholly heuristic and therefore still do not sum to the header ([rationale](../../llm/token-meter/README.md)). Occupancy is deliberately an approximation: numerator and capacity are independent last-wins projection fields, not one atomic request observation.

const select: ChainSelect<ComposerChainProps, Request> = owner =>
  owner.sessionId === request.sessionId ? request : null

const dispose = ctx.slots.register(
  { name: 'conversation.composer', select },
  RequestComposer,
)

try {
  return await request.result
} finally {
  dispose()
}
```

The selector must be a pure function of the owner currency. Its non-null return is delivered to the component as `matched`; `PropsRuntime<'conversation.composer'>` supplies the standard Session and global props. Chain order remains ascending `priority`, then registration order, and the first non-null selector wins. The shell keeps the default composer mounted beneath a takeover. Request state, listeners, response encoding, and any request-specific child slots belong to the business package; they are not carried by `SessionSnapshot` or declared by this core package.

<a id="model-experience"></a>
## Model Experience

None, as this package renders browser state and sends user-admitted inputs through Session Controller APIs without constructing model requests.

#### KV Cache effect

None; Conversation assembly and browser input state do not alter provider-side prompt caching.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Only registered targets can render** — the shell deliberately has no implicit fallback target beyond the registered `chat` preference.


<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
- **The stats-line fallback fold covers the in-window flow only** — without the `sessionStats` projection (an assembly that does not mount the unit), every figure folds the snapshot's assistant `timing` and tool call/result pairs, so nodes outside the loaded event window (older history) are not counted and the numbers grow per loaded page.
- **The details panel has no entry point** — `ChatViewInjected.openDetails` is implemented but uncalled, so the raw selected-call display is unreachable in the assembled application. There is no Input/Output/Metadata switch, Prev/Next stepping, or trajectory deep link.
- **Assistant per-message paging is a reserved slot** — drawn in the design, not implemented. The finalized content IconActions row (copy / clock / branch) ships under the last content-text assistant of each turn that has ended; mid-turn narration, Think-only nodes, and every node of a turn still producing steps stay chrome-free. Branch stays disabled unless that message is also the last transcript node of a completed turn; when enabled, it forks through that turn, increments the inherited title on the client, and opens the child. A fork or rename failure leaves the source selected ([decision](../../../.agents/notes/implemented/bug-fix/2026-08-02-message-fork-actions-require-completed-turn-tail.md)).
- **Settled user prompts edit in the same session** — user bubbles show clock, copy, and edit; branch still lives only under assistant answers ([decision](../../../.agents/notes/implemented/simplification/2026-08-06-user-bubbles-drop-the-branch-action.md)). Saving a settled prompt calls `session.rewrite`, which replaces that prompt and later surface nodes in this session and starts a new turn from the replacement ([decision](../../../.agents/notes/implemented/feature/2026-08-20-same-session-user-prompt-rewrite.md)). Steering and pending bubbles stay copy-only; queue edit remains a pending-inbox operation.
- **The sparkle icon for the others tool row is a hand-drawn approximation** — the design glyph's vector geometry is not exportable locally; promotion into ui-primitives waits on an exact export.
- **The approval panel has no durable grant control** — it supports allow-once and reject only.
- **TodoPanel truncates long item text to one ellipsized line** — the figma strip has no wrap or expand affordance; full text is not readable inline.
- **Queue edit rewrites text only** — the inline editor sends one text block; the host keeps already-admitted images and other non-text blocks. Edit mode replaces delete and strict steer with save and cancel; Enter saves and Escape cancels.
- **Queue strict steer preserves complete messages** — while the Agent is running, the steer action atomically transfers the addressed Queue occurrence into the current next-step window. Mixed-content rows remain eligible because the action forwards the immutable message instead of the text projection. The placement-aware Host snapshot renders pending steering at the conversation tail until the consumed `user/message` folds into the durable transcript, so immediate display, reconnect, and replay share one linear authority.
