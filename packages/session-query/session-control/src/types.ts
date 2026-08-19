/** Public session-control directory, stop, and delivery records. */

import type { MessageId } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'

/** Live driver activity for one logical session. */
export type SessionControlActivity = 'running' | 'idle' | 'ready'

/** How a later message should enter the target inbox. */
export type SessionControlDeliveryMode = 'queue' | 'steer'

/** One logical session plus its live driver status. */
export interface SessionControlEntry {
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
}

/** Search request over the complete logical corpus. */
export interface SessionControlSearchRequest {
  /** Optional case-insensitive session-id, cwd, or title substring. */
  query?: string
  /** Optional positive result cap; defaults to the service configuration. */
  limit?: number
}

/** Receipt returned once a stop request is admitted. */
export interface SessionControlStopReceipt {
  /** Whether a live Agent received the cancel signal. */
  accepted: true
  /** Whether a live Agent was present to receive the signal. */
  attached: boolean
}

/** Delivery request for one later user-role message. */
export interface SessionControlSendRequest {
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

/** Receipt returned once the target inbox accepts a message. */
export interface SessionControlSendReceipt {
  /** Stable identity of the accepted message. */
  messageId: MessageId
}
