/**
 * Whole-log token, duration, and calendar-day usage fold for the Settings
 * usage page.
 *
 * @module @deepseek-ai/dsh-session-stats/usage
 */

import { z } from 'zod'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionUsageProjection } from './types.ts'

const bucketsSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
}).strict()

const sessionUsageSchema = z.object({
  tokens: z.number().int().nonnegative(),
  peakTokens: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  peakDurationMs: z.number().int().nonnegative(),
  firstActivityAt: z.number().int().nonnegative().nullable(),
  lastActivityAt: z.number().int().nonnegative().nullable(),
  days: z.array(z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tokens: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    models: z.record(z.string(), z.number().int().nonnegative()),
  }).strict()),
  models: z.array(z.object({
    model: z.string().min(1),
    tokens: z.number().int().nonnegative(),
  }).strict()),
}).strict()

interface SessionUsageState {
  tokens: number
  peakTokens: number
  durationMs: number
  peakDurationMs: number
  firstActivityAt: number | null
  lastActivityAt: number | null
  days: Record<string, { tokens: number; durationMs: number; models: Record<string, number> }>
  models: Record<string, number>
  route: string | null
  openStep: {
    turn: number
    step: number
    startTime: number
    model: string | null
    last: { turn: number; step: number; buckets: z.infer<typeof bucketsSchema> } | null
  } | null
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    sessionUsage: SessionUsageState
  }
}

const sessionUsageStateSchema = z.object({
  tokens: z.number().int().nonnegative(),
  peakTokens: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  peakDurationMs: z.number().int().nonnegative(),
  firstActivityAt: z.number().int().nonnegative().nullable(),
  lastActivityAt: z.number().int().nonnegative().nullable(),
  days: z.record(z.string(), z.object({
    tokens: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    models: z.record(z.string(), z.number().int().nonnegative()),
  }).strict()),
  models: z.record(z.string(), z.number().int().nonnegative()),
  route: z.string().min(1).nullable(),
  openStep: z.object({
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    startTime: z.number().nonnegative(),
    model: z.string().min(1).nullable(),
    last: z.object({
      turn: z.number().int().nonnegative(),
      step: z.number().int().nonnegative(),
      buckets: bucketsSchema,
    }).nullable(),
  }).nullable(),
}).strict()

const zeroBuckets = (): z.infer<typeof bucketsSchema> => ({
  uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
})
const tokenTotal = (b: z.infer<typeof bucketsSchema>): number =>
  b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens
const bucketsFromUsage = (usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }) => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
})
const bucketsEqual = (l: z.infer<typeof bucketsSchema>, r: z.infer<typeof bucketsSchema>): boolean =>
  l.uncachedInputTokens === r.uncachedInputTokens && l.outputTokens === r.outputTokens
  && l.cacheReadTokens === r.cacheReadTokens && l.cacheWriteTokens === r.cacheWriteTokens

/**
 * UTC calendar day of an epoch millisecond timestamp.
 * @param time - epoch milliseconds.
 * @returns YYYY-MM-DD in UTC.
 */
export function utcDayKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

function addTokens(state: SessionUsageState, time: number, model: string | null, delta: number): SessionUsageState {
  if (delta === 0) return state
  const day = utcDayKey(time)
  const nextDays = { ...state.days }
  const row = nextDays[day] ?? { tokens: 0, durationMs: 0, models: {} }
  const nextModels = { ...row.models }
  const totals = { ...state.models }
  if (model !== null) {
    nextModels[model] = (nextModels[model] ?? 0) + delta
    totals[model] = (totals[model] ?? 0) + delta
  }
  nextDays[day] = { ...row, tokens: row.tokens + delta, models: nextModels }
  const tokens = state.tokens + delta
  return {
    ...state,
    tokens,
    peakTokens: Math.max(state.peakTokens, tokens),
    firstActivityAt: state.firstActivityAt ?? time,
    lastActivityAt: time,
    days: nextDays,
    models: totals,
  }
}

function addDuration(state: SessionUsageState, time: number, delta: number): SessionUsageState {
  if (delta <= 0) return state
  const day = utcDayKey(time)
  const nextDays = { ...state.days }
  const row = nextDays[day] ?? { tokens: 0, durationMs: 0, models: {} }
  nextDays[day] = { ...row, durationMs: row.durationMs + delta }
  const durationMs = state.durationMs + delta
  return {
    ...state,
    durationMs,
    peakDurationMs: Math.max(state.peakDurationMs, durationMs),
    firstActivityAt: state.firstActivityAt ?? time,
    lastActivityAt: time,
    days: nextDays,
  }
}

function applyUsage(
  state: SessionUsageState,
  time: number,
  turn: number,
  step: number,
  buckets: z.infer<typeof bucketsSchema>,
): SessionUsageState {
  const open = state.openStep
  if (open === null || open.turn !== turn || open.step !== step) return state
  const previous = open.last === null ? zeroBuckets() : open.last.buckets
  if (bucketsEqual(previous, buckets)) return state
  const next = addTokens(state, time, open.model, tokenTotal(buckets) - tokenTotal(previous))
  return { ...next, openStep: { ...open, last: { turn, step, buckets } } }
}

function viewOf(state: SessionUsageState): SessionUsageProjection {
  return {
    tokens: state.tokens,
    peakTokens: state.peakTokens,
    durationMs: state.durationMs,
    peakDurationMs: state.peakDurationMs,
    firstActivityAt: state.firstActivityAt,
    lastActivityAt: state.lastActivityAt,
    days: Object.entries(state.days)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, row]) => ({ day, tokens: row.tokens, durationMs: row.durationMs, models: row.models })),
    models: Object.entries(state.models)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([model, tokens]) => ({ model, tokens })),
  }
}

/** The `sessionUsage` unit registered on `ctx.sessionProjections`. */
export const sessionUsageProjectionDefinition = {
  key: 'sessionUsage',
  stateVersion: 1,
  stateSchema: sessionUsageStateSchema,
  init: (): SessionUsageState => ({
    tokens: 0,
    peakTokens: 0,
    durationMs: 0,
    peakDurationMs: 0,
    firstActivityAt: null,
    lastActivityAt: null,
    days: {},
    models: {},
    route: null,
    openStep: null,
  }),
  apply: (state, event) => {
    switch (event.type) {
      case 'request/header': {
        const model = event.data.header.config.model
        return state.route === model ? state : { ...state, route: model }
      }
      case 'step/start':
        return {
          ...state,
          openStep: {
            turn: event.data.turn,
            step: event.data.step,
            startTime: event.time,
            model: state.route,
            last: null,
          },
        }
      case 'llm/retry-started': {
        const open = state.openStep
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
        return open.last === null ? state : { ...state, openStep: { ...open, last: null } }
      }
      case 'assistant/message': {
        let next = state
        if (event.data.usage !== undefined) {
          next = applyUsage(
            next,
            event.time,
            event.data.turn,
            event.data.step,
            bucketsFromUsage(event.data.usage),
          )
        }
        const open = next.openStep
        if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return next
        return { ...addDuration(next, event.time, Math.max(0, event.time - open.startTime)), openStep: null }
      }
      case 'step/end':
        return state.openStep === null ? state : { ...state, openStep: null }
      default:
        return state
    }
  },
  wire: { viewSchema: sessionUsageSchema, view: viewOf },
} satisfies ProjectionDefinition<'sessionUsage', SessionUsageState>
