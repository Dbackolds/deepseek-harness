/**
 * Pure types of the session-route domain: the ONE home of the `requestRoute`
 * projection-key declaration, free of this package's host-side value imports
 * (cordis context, zod). Two namespace projections serve it — `./types` for
 * host consumers, `./client` for client aggregates — with zero content
 * duplication.
 *
 * @module @deepseek-ai/dsh-session-route/types
 */

// Marks this file a module so the declaration below AUGMENTS the projection
// table instead of declaring an ambient module.
export {}

/**
 * The route of the latest dispatched request, folded whole-log from
 * `request/header` events: the identity of the model a session is actually
 * running, independent of any composer selector state. `reasoningEffort` is
 * absent when the logged header carried none.
 */
export interface RequestRouteProjection {
  /** Registered provider route of the latest logged request header. */
  provider: string
  /** Provider-owned model id of the latest logged request header. */
  model: string
  /** Adapter-owned reasoning-effort id, when the header carried one. */
  reasoningEffort?: string
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    requestRoute: RequestRouteProjection | null
  }
  interface SessionProjectionMap {
    /**
     * The session's current request route — the latest `request/header`
     * snapshot's config triple (latest wins, `reason` never matters), or
     * `null` before the log's first request header. A plain JSON value: the
     * shape the header identity label and per-step model lines consume.
     */
    requestRoute: RequestRouteProjection | null
  }
}
