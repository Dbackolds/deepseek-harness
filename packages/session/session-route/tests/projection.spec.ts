/**
 * The `requestRoute` projection unit: mounting the plugin beside the
 * projection registry serves the latest-wins fold of `request/header` events
 * — the route of the last dispatched request, `null` before the first
 * header, newest header winning across a mid-session model switch, and
 * neither the header `reason` nor the surrounding turn/step events changing
 * what is served; compositions without the registry are unaffected;
 * unmounting the plugin removes the key (HMR safety). Definition-level folds
 * pin the same-reference rule (Object.is gates the change feed), including
 * the resume re-log of an identical header.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionRoutePlugin from '@deepseek-ai/dsh-session-route'
import { requestRouteProjectionDefinition } from '@deepseek-ai/dsh-session-route/src/projection.ts'
import type { RequestRouteProjection } from '@deepseek-ai/dsh-session-route/types'

async function harness(withRoutePlugin: boolean): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  if (withRoutePlugin) await ctx.plugin(SessionRoutePlugin)
  return { ctx, session: ctx.sessions.create(SessionId('routed')) }
}

/** One logged request-header payload with the exact LlmCallConfig shape. */
function headerEvent(
  provider: string,
  model: string,
  reason: 'initial' | 'resume' | 'change' = 'initial',
  reasoningEffort?: string,
): { header: { config: { provider: string; model: string; reasoningEffort?: string } }; reason: 'initial' | 'resume' | 'change' } {
  return {
    header: {
      config: {
        provider,
        model,
        ...reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(reasoningEffort) },
      },
    },
    reason,
  }
}

describe('requestRoute projection unit (registry drive)', () => {
  it('serves no route on the empty log', async () => {
    const { ctx, session } = await harness(true)
    expect(ctx.sessionProjections.snapshot(session).values.requestRoute).toBeNull()
  })

  it('folds the log\'s single request header and notifies the change feed with the causing seq', async () => {
    const { ctx, session } = await harness(true)
    const changes: { key: string; value: unknown; seq: number }[] = []
    ctx.sessionProjections.onChanged((_session, key, value, seq) => {
      changes.push({ key, value, seq })
    })
    session.append('turn/start', { turn: 1 })
    const headerSeq = session.append('request/header', headerEvent('mock', 'mock-xl', 'initial', 'high')).seq
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    // Only the header event changes the fold; turn/step boundaries stay silent.
    expect(changes).toEqual([
      { key: 'requestRoute', value: { provider: 'mock', model: 'mock-xl', reasoningEffort: 'high' }, seq: headerSeq },
    ])
    const snapshot = ctx.sessionProjections.snapshot(session)
    expect(snapshot.values.requestRoute).toEqual({ provider: 'mock', model: 'mock-xl', reasoningEffort: 'high' })
    expect(snapshot.asOfSeq).toBe(session.seq - 1)
  })

  it('serves the newest header across a mid-session model switch', async () => {
    const { ctx, session } = await harness(true)
    session.append('request/header', headerEvent('mock', 'mock-xl', 'initial', 'high'))
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    // The switch: another provider and model, and no reasoning effort at all.
    session.append('request/header', headerEvent('other', 'other-pro', 'change'))
    const value = ctx.sessionProjections.snapshot(session).values.requestRoute as RequestRouteProjection
    expect(value).toEqual({ provider: 'other', model: 'other-pro' })
    expect('reasoningEffort' in value).toBe(false)
  })

  it('stays silent when a resume re-logs the identical header', async () => {
    const { ctx, session } = await harness(true)
    const changes: unknown[] = []
    ctx.sessionProjections.onChanged(() => changes.push(changes.length))
    session.append('request/header', headerEvent('mock', 'mock-xl', 'initial', 'high'))
    expect(changes).toHaveLength(1)
    // A process restart re-logs the same header under reason 'resume'; the
    // route is unchanged, so the fold returns the same reference and the
    // change feed stays quiet.
    session.append('request/header', headerEvent('mock', 'mock-xl', 'resume', 'high'))
    expect(changes).toHaveLength(1)
    expect(ctx.sessionProjections.snapshot(session).values.requestRoute)
      .toEqual({ provider: 'mock', model: 'mock-xl', reasoningEffort: 'high' })
  })

  it('folds headers already in the log when the plugin mounts late (lazy cell build)', async () => {
    const { ctx, session } = await harness(false)
    session.append('request/header', headerEvent('mock', 'mock-xl', 'initial'))
    session.append('request/header', headerEvent('mock', 'mock-mini', 'change'))
    await ctx.plugin(SessionRoutePlugin)
    expect(ctx.sessionProjections.snapshot(session).values.requestRoute)
      .toEqual({ provider: 'mock', model: 'mock-mini' })
  })

  it('has no requestRoute key without the plugin, and drops it when the plugin unloads (HMR safety)', async () => {
    const { ctx, session } = await harness(false)
    expect('requestRoute' in ctx.sessionProjections.snapshot(session).values).toBe(false)
    const fiber = await ctx.plugin(SessionRoutePlugin)
    session.append('request/header', headerEvent('mock', 'mock-xl', 'initial'))
    expect(ctx.sessionProjections.snapshot(session).values.requestRoute)
      .toEqual({ provider: 'mock', model: 'mock-xl' })
    await fiber.dispose()
    expect('requestRoute' in ctx.sessionProjections.snapshot(session).values).toBe(false)
  })
})

/** Build one synthetic committed event. */
function at(type: string, data: unknown): SessionEvent {
  return { type, seq: 0, time: 0, data } as unknown as SessionEvent
}

/** Fold a synthetic event list through the definition and view the result. */
function fold(events: readonly SessionEvent[]): RequestRouteProjection | null {
  const state = events.reduce<Parameters<typeof requestRouteProjectionDefinition.apply>[0]>(
    (folded, event) => requestRouteProjectionDefinition.apply(folded, event),
    requestRouteProjectionDefinition.init(),
  )
  return requestRouteProjectionDefinition.wire.view(state)
}

describe('requestRoute fold (definition drive)', () => {
  it('starts null and accrues nothing from unrelated events', () => {
    expect(fold([])).toBeNull()
    const state = requestRouteProjectionDefinition.init()
    expect(requestRouteProjectionDefinition.apply(state, at('turn/start', { turn: 1 }))).toBe(state)
    expect(requestRouteProjectionDefinition.apply(state, at('request/context', { provider: 'mock', model: 'mock-xl' })))
      .toBe(state)
    expect(fold([at('turn/start', { turn: 1 }), at('turn/end', { turn: 1, reason: { kind: 'completed' } })]))
      .toBeNull()
  })

  it('keeps only the identity triple, ignoring the reason and every other header field', () => {
    expect(fold([
      at('request/header', headerEvent('mock', 'mock-xl', 'initial', 'high')),
    ])).toEqual({ provider: 'mock', model: 'mock-xl', reasoningEffort: 'high' })
    // A header carrying prompt payload fields serves the same triple.
    const rich = at('request/header', {
      header: {
        config: { provider: 'mock', model: 'mock-xl' },
        system: 'You are a harness.',
      },
      reason: 'change',
    })
    expect(fold([rich])).toEqual({ provider: 'mock', model: 'mock-xl' })
  })

  it('later header wins and an identical repeat keeps the same state reference', () => {
    const first = at('request/header', headerEvent('mock', 'mock-xl', 'initial', 'high'))
    const state = requestRouteProjectionDefinition.apply(requestRouteProjectionDefinition.init(), first)
    const switched = requestRouteProjectionDefinition.apply(
      state,
      at('request/header', headerEvent('mock', 'mock-mini', 'change')),
    )
    expect(switched).not.toBe(state)
    expect(requestRouteProjectionDefinition.wire.view(switched)).toEqual({ provider: 'mock', model: 'mock-mini' })
    // Same triple again — even a fresh object input folds to the same reference.
    expect(requestRouteProjectionDefinition.apply(
      switched,
      at('request/header', headerEvent('mock', 'mock-mini', 'resume')),
    )).toBe(switched)
  })
})
