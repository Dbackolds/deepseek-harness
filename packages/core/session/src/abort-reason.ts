/**
 * Render abort-signal reasons, including typed {@link AgentCancelCause} objects
 * that `String()` collapses to `[object Object]`.
 * @module @deepseek-ai/dsh-session/abort-reason
 */

import { assertNever } from '@deepseek-ai/dsh-util-values'
import type { AgentCancelCause } from './types.ts'

/**
 * Format a typed cancellation cause as a short diagnostic string.
 * @param cause - the live abort reason from {@link Agent.cancel}.
 * @returns a stable English phrase, never `[object Object]`.
 */
export function formatAgentCancelCause(cause: AgentCancelCause): string {
  switch (cause.kind) {
    case 'user':
      return 'cancelled by user'
    case 'parent':
      return 'cancelled by parent'
    case 'hook':
      return `cancelled by hook: ${cause.reason}`
    case 'disposed':
      return 'agent disposed'
    case 'automation':
      return `cancelled by automation ${cause.ruleId}`
    /* v8 ignore next -- closed-union exhaustiveness guard */
    default:
      return assertNever(cause, 'agent cancel cause')
  }
}

/**
 * Whether `value` is a typed {@link AgentCancelCause}.
 * @param value - an abort-signal reason or other thrown value.
 * @returns true only for a plain object whose `kind` is a known cancel cause.
 */
export function isAgentCancelCause(value: unknown): value is AgentCancelCause {
  if (typeof value !== 'object' || value === null) return false
  const kind: unknown = Reflect.get(value, 'kind')
  if (kind === 'user' || kind === 'parent' || kind === 'disposed') return true
  if (kind === 'hook') return typeof Reflect.get(value, 'reason') === 'string'
  if (kind === 'automation') return typeof Reflect.get(value, 'ruleId') === 'string'
  return false
}

/**
 * Render an abort-signal reason for model-facing or log diagnostics.
 * Typed cancel causes use {@link formatAgentCancelCause}; Errors use
 * `message`; everything else stringifies.
 * @param reason - `AbortSignal.reason`, which may be undefined.
 * @returns a non-empty diagnostic, or `aborted` when the reason is absent.
 */
export function formatAbortReason(reason: unknown): string {
  if (reason === undefined) return 'aborted'
  if (isAgentCancelCause(reason)) return formatAgentCancelCause(reason)
  if (reason instanceof Error) return reason.message === '' ? reason.name : reason.message
  if (typeof reason === 'string') return reason
  return String(reason)
}
