/** Resume crash/reload-interrupted Sessions discovered by session.list. */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { interruptedTurnClosers } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionListMetadata } from './api/sessions.ts'

/**
 * Fold one event into list metadata, including crash/reload interruption.
 * @param state - previous fold.
 * @param event - next durable event.
 * @returns next fold.
 */
export function applyInterruptedListMetadata(
  state: SessionListMetadata,
  event: SessionEvent,
): SessionListMetadata {
  const blank = state.blank && event.type !== 'turn/start'
  const lastPromptAt = event.type === 'user/message' && event.data.source.kind === 'user'
    ? event.time
    : state.lastPromptAt
  let interrupted = state.interrupted === true
  if (event.type === 'turn/start') interrupted = false
  else if (event.type === 'turn/end' && event.data.reason.kind === 'interrupted') interrupted = true
  if (blank === state.blank && lastPromptAt === state.lastPromptAt && interrupted === (state.interrupted === true)) {
    return state
  }
  return { blank, lastPromptAt, ...interrupted ? { interrupted: true } : {} }
}

/**
 * Fold events plus in-memory interruption repair into list metadata.
 * @param events - attached or inspected events.
 * @returns list metadata including an open interrupted turn.
 */
export function foldListMetadataWithRepair(events: readonly SessionEvent[]): SessionListMetadata {
  let state: SessionListMetadata = { blank: true, lastPromptAt: null }
  for (const event of [...events, ...interruptedTurnClosers(events)]) {
    state = applyInterruptedListMetadata(state, event)
  }
  return state
}

/** Resolve one Session identity to a live Agent or a lookup error. */
export type InterruptedResumeLookup = (sessionId: SessionId) => Promise<
  { agent: Agent } | { error: { message: string } }
>

/**
 * Resume each interrupted Session once and wake a continuation turn.
 * @param ctx - host context used for logging.
 * @param agentFor - live/cold Agent resolver.
 * @returns a scheduler that ignores duplicate ids.
 */
export function createInterruptedResumeScheduler(
  ctx: Context,
  agentFor: InterruptedResumeLookup,
): (sessionId: SessionId) => void {
  const scheduled = new Set<SessionId>()
  return (sessionId) => {
    if (ctx.get('agents') === undefined || scheduled.has(sessionId)) return
    scheduled.add(sessionId)
    void agentFor(sessionId).then((found) => {
      if ('error' in found) {
        scheduled.delete(sessionId)
        ctx.logger.warn(`session.list: resume after interruption failed for "${sessionId}": ${found.error.message}`)
        return
      }
      if (found.agent.status === 'running') return
      found.agent.followup(createUserMessage({
        content: [{ type: 'text', text: 'Continue the work that was interrupted by a restart.' }],
        source: {
          kind: 'plugin',
          plugin: 'dsh-host-apiproxy',
          form: 'notice',
          summary: 'Resumed after restart',
        },
      }))
    }).catch((error: unknown) => {
      scheduled.delete(sessionId)
      ctx.logger.warn(`session.list: resume after interruption failed for "${sessionId}": ${String(error)}`)
    })
  }
}
