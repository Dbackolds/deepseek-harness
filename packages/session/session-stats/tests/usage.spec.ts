import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import type { AssistantStreamRecord, TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionStatsPlugin from '@deepseek-ai/dsh-session-stats'
import { sessionUsageProjectionDefinition } from '../src/usage.ts'
import { aggregateUsage, EMPTY_SESSION_USAGE, rebaseUsageDay, zonedDayKey } from '../src/aggregate.ts'
import type { SessionUsageProjection } from '../src/types.ts'

async function harness(): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SessionStatsPlugin)
  return { ctx, session: ctx.sessions.create(SessionId('usage')) }
}

function usage(inputTokens: number, outputTokens: number): TokenUsage {
  return { inputTokens, outputTokens }
}

function at(time: number, type: string, data: unknown): SessionEvent {
  return { type, seq: time, time, data } as unknown as SessionEvent
}

function fold(events: readonly SessionEvent[]): SessionUsageProjection {
  const state = events.reduce(
    (folded, event) => sessionUsageProjectionDefinition.apply(folded, event),
    sessionUsageProjectionDefinition.init(),
  )
  return sessionUsageProjectionDefinition.wire.view(state)
}

describe('sessionUsage projection unit', () => {
  it('serves EMPTY_SESSION_USAGE on the empty log', async () => {
    const { ctx, session } = await harness()
    expect(ctx.sessionProjections.snapshot(session).values.sessionUsage).toEqual(EMPTY_SESSION_USAGE)
  })

  it('attributes tokens, duration, model, and UTC day from header, step, and message', () => {
    const start = Date.parse('2026-03-01T12:00:00.000Z')
    const view = fold([
      at(start, 'request/header', { header: { config: { provider: 'mock', model: 'glm-flash' } }, reason: 'initial' }),
      at(start, 'step/start', { turn: 1, step: 1 }),
      at(start + 5_000, 'assistant/message', {
        turn: 1,
        step: 1,
        message: {},
        usage: usage(10, 20),
      }),
    ])
    expect(view).toMatchObject({
      tokens: 30,
      peakTokens: 30,
      durationMs: 5_000,
      peakDurationMs: 5_000,
      days: [{ day: '2026-03-01', tokens: 30, durationMs: 5_000, models: { 'glm-flash': 30 } }],
      models: [{ model: 'glm-flash', tokens: 30 }],
    })
  })

  it('replaces an in-step usage chunk instead of double counting it', () => {
    const view = fold([
      at(1_000, 'request/header', { header: { config: { provider: 'mock', model: 'a' } }, reason: 'initial' }),
      at(1_000, 'step/start', { turn: 1, step: 1 }),
      at(1_200, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: usage(4, 6) } }),
      at(1_500, 'assistant/message', { turn: 1, step: 1, message: {}, usage: usage(5, 15) }),
    ])
    expect(view.tokens).toBe(20)
    expect(view.durationMs).toBe(500)
  })

  it('attributes tokens to the request-header model through the live registry', async () => {
    const { ctx, session } = await harness()
    session.append('request/header', { header: { config: { provider: 'mock', model: 'glm-flash' } }, reason: 'initial' })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      }),
      stream: [] as AssistantStreamRecord[],
      usage: usage(10, 20),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    const view = ctx.sessionProjections.snapshot(session).values.sessionUsage
    expect(view?.tokens).toBe(30)
    expect(view?.models).toEqual([{ model: 'glm-flash', tokens: 30 }])
  })
})

describe('usage aggregation', () => {
  it('rebases a UTC day onto the local calendar that contains that midnight', () => {
    const row = rebaseUsageDay(
      { day: '2026-03-01', tokens: 8, durationMs: 100, models: { a: 8 } },
      'America/Los_Angeles',
    )
    expect(row.day).toBe('2026-02-28')
    expect(zonedDayKey(Date.parse('2026-03-01T08:00:00.000Z'), 'America/Los_Angeles')).toBe('2026-03-01')
  })

  it('sums sessions, ranks models, and counts current and longest streaks', () => {
    const first: SessionUsageProjection = {
      tokens: 10, peakTokens: 10, durationMs: 1_000, peakDurationMs: 1_000,
      firstActivityAt: Date.parse('2026-03-01T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-02T00:00:00.000Z'),
      days: [
        { day: '2026-03-01', tokens: 4, durationMs: 400, models: { a: 4 } },
        { day: '2026-03-02', tokens: 6, durationMs: 600, models: { a: 6 } },
      ],
      models: [{ model: 'a', tokens: 10 }],
    }
    const second: SessionUsageProjection = {
      tokens: 5, peakTokens: 9, durationMs: 200, peakDurationMs: 700,
      firstActivityAt: Date.parse('2026-03-04T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-05T00:00:00.000Z'),
      days: [
        { day: '2026-03-04', tokens: 2, durationMs: 80, models: { b: 2 } },
        { day: '2026-03-05', tokens: 3, durationMs: 120, models: { b: 3 } },
      ],
      models: [{ model: 'b', tokens: 5 }],
    }
    const overview = aggregateUsage([first, second], 'UTC', Date.parse('2026-03-05T12:00:00.000Z'))
    expect(overview.tokens).toBe(15)
    expect(overview.peakTokens).toBe(10)
    expect(overview.durationMs).toBe(1_200)
    expect(overview.peakDurationMs).toBe(1_000)
    expect(overview.currentStreakDays).toBe(2)
    expect(overview.longestStreakDays).toBe(2)
    expect(overview.models.map(row => row.model)).toEqual(['a', 'b'])
  })
})
