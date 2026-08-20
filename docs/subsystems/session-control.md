# Session Control

English | [中文](session-control.zh.md)

Trusted in-process directory, stop, and delivery over every logical session. The [package contract](../../packages/session-query/session-control) defines search, live driver status, stop semantics, send receipts, and the stable error taxonomy. Hosts and plugins call these types instead of assembling `ctx.sessionQuery` plus `ctx.agents` themselves.

Source: [`packages/session-query/session-control/src/types.ts`](../../packages/session-query/session-control/src/types.ts)

## Directory rows

`SessionControlEntry` is one logical session plus its live driver status. `ready` names a corpus identity with no live Agent; `search()` never resumes that identity. `archived` is registry-global grouping membership and is `false` when `ctx.workspaceRegistry` is not mounted.

```ts type-equiv
/** Live driver activity for one logical session. */
type SessionControlActivity = 'running' | 'idle' | 'ready'
```

```ts type-equiv
/**
 * How search treats registry-global archived membership.
 * `all` includes archived rows, `only` keeps them, and `exclude` drops them.
 */
type SessionControlArchiveFilter = 'all' | 'only' | 'exclude'
```

```ts type-equiv
/** One logical session plus its live driver status. */
interface SessionControlEntry {
  /** Opaque session identity. */
  sessionId: SessionId
  /** Latest log-backed title, falling back to the session id. */
  title: string
  /** Session working directory, when recorded. */
  cwd?: string
  /** Fork or spawn parent, when recorded. */
  parentSessionId?: SessionId
  /** Coarse durable origin used by navigation surfaces. */
  origin?: 'subagent' | 'automation'
  /** Agent preset recorded on the header, when the deployment composes presets. */
  agentPreset?: string
  /** Session creation time in Unix epoch milliseconds. */
  createdAt: number
  /**
   * Live driver activity: `running` has an active driver, `idle` is attached
   * between turns, and `ready` exists only in the logical corpus.
   */
  activity: SessionControlActivity
  /** Whether the id currently exists in `ctx.sessions`. */
  live: boolean
  /** Whether the active persistence backend currently materializes the id. */
  persisted: boolean
  /**
   * Whether the id is in `ctx.workspaceRegistry.archivedSessionIds`.
   * False when the registry is not mounted.
   */
  archived: boolean
}
```

## Search, stop, and send

`search()` filters id, cwd, and folded title. Optional `archive` defaults to `all` and may be `only` or `exclude`; that filter runs before `limit`. `stop()` cancels a live turn and keeps the inbox. `send()` delivers one text block to a live Agent and refuses to take a resume handle.

```ts type-equiv
/** Search request over the complete logical corpus. */
interface SessionControlSearchRequest {
  /** Optional case-insensitive session-id, cwd, or title substring. */
  query?: string
  /** Optional positive result cap; defaults to the service configuration. */
  limit?: number
  /**
   * How to treat registry-global archived membership. Defaults to `all`.
   * The filter runs before `limit`.
   */
  archive?: SessionControlArchiveFilter
}
```

```ts type-equiv
/** Receipt returned once a stop request is admitted. */
interface SessionControlStopReceipt {
  /** Whether a live Agent received the cancel signal. */
  accepted: true
  /** Whether a live Agent was present to receive the signal. */
  attached: boolean
}
```

```ts type-equiv
/** How a later message should enter the target inbox. */
type SessionControlDeliveryMode = 'queue' | 'steer'
```

```ts type-equiv
/** Delivery request for one later user-role message. */
interface SessionControlSendRequest {
  /** Target session identity. */
  sessionId: SessionId
  /** User-role text delivered as one text block. */
  message: string
  /**
   * Inbox placement. `queue` is the next turn; `steer` is the nearest step.
   * Defaults to `queue`.
   */
  mode?: SessionControlDeliveryMode
}
```

```ts type-equiv
/** Receipt returned once the target inbox accepts a message. */
interface SessionControlSendReceipt {
  /** Stable identity of the accepted message. */
  messageId: MessageId
}
```

## Errors

`SessionControlError.code` separates invalid configuration or input, a missing identity, an attached session without a live Agent, a storage-only identity that still needs resume, a failed inbox admission, and cancellation.

```ts type-equiv
/** Stable failure codes exposed to in-process callers. */
type SessionControlErrorCode =
  | 'SESSION_CONTROL_INVALID_CONFIG'
  | 'SESSION_CONTROL_INVALID_REQUEST'
  | 'SESSION_CONTROL_SESSION_NOT_FOUND'
  | 'SESSION_CONTROL_NOT_ATTACHED'
  | 'SESSION_CONTROL_RESUME_REQUIRED'
  | 'SESSION_CONTROL_DELIVERY_FAILED'
  | 'SESSION_CONTROL_CANCELLED'
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxsessioncontrol--sessioncontrol"></a>

### `ctx.sessionControl` — `SessionControl`

Trusted directory, stop, and delivery operations over the logical session corpus.

```ts cordis-catalog
/**
 * Search every logical session and attach live driver status.
 * Optional `archive` defaults to `all` and includes archived rows from
 * `ctx.workspaceRegistry` when that service is mounted. The filter runs
 * before `limit`.
 * @param request - optional case-insensitive query, result cap, and archive filter.
 * @param signal - optional cancellation for persistence listing and title reads.
 * @returns matching directory rows in newest-first corpus order.
 */
async search( request: SessionControlSearchRequest = {}, signal?: AbortSignal, ): Promise<SessionControlEntry[]>

/**
 * Read one logical session and its live driver status.
 * @param sessionId - live or persisted session id.
 * @param signal - optional cancellation for title observation.
 * @returns the directory row for that identity.
 */
async get( sessionId: SessionId, signal?: AbortSignal, ): Promise<SessionControlEntry>

/**
 * Stop the current turn of an attached session and keep pending inbox work.
 * A storage-only identity is an accepted no-op: there is no live driver to
 * cancel, and this call never resumes a cold session.
 * @param sessionId - live or persisted session id.
 * @param signal - optional cancellation for the corpus existence check.
 * @returns whether a live Agent received the cancel signal.
 */
async stop( sessionId: SessionId, signal?: AbortSignal, ): Promise<SessionControlStopReceipt>

/**
 * Deliver one later user-role message to a live Agent. A storage-only
 * identity fails with SESSION_CONTROL_RESUME_REQUIRED; this service does
 * not resume, because resume owns an AgentHandle that the caller or the
 * subagent continuation manager must retain.
 * @param request - target id, text, and inbox placement.
 * @param signal - optional cancellation for the corpus existence check.
 * @returns the accepted message id.
 */
async send( request: SessionControlSendRequest, signal?: AbortSignal, ): Promise<SessionControlSendReceipt>
```

Types: [SessionId](core.md)

Source: [`packages/session-query/session-control/src/index.ts:40`](../../packages/session-query/session-control/src/index.ts)
<!-- END GENERATED cordis-surface -->
