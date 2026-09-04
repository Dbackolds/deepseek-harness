/**
 * Calendar-day rebasing and Host-wide usage aggregation for the Settings page.
 *
 * Session usage projections store UTC days. The Remote rebases those rows onto
 * the caller IANA zone, then sums tokens, duration, streaks, and model shares
 * across every visible Session.
 *
 * @module @deepseek-ai/dsh-session-stats/aggregate
 */

import type { SessionUsageDay, SessionUsageProjection } from './types.ts'

/** Empty usage view before the first contributing event. */
export const EMPTY_SESSION_USAGE: SessionUsageProjection = {
  tokens: 0,
  peakTokens: 0,
  durationMs: 0,
  peakDurationMs: 0,
  firstActivityAt: null,
  lastActivityAt: null,
  days: [],
  models: [],
}

function calendarPart(parts: Intl.DateTimeFormatPart[], type: string, fallback: string): string {
  return parts.find(item => item.type === type)?.value ?? fallback
}

function previousDay(days: readonly string[], index: number): string {
  return days[index - 1] ?? days[0] ?? ''
}

/**
 * Calendar day YYYY-MM-DD of an epoch millisecond timestamp in one IANA zone.
 * @param time - epoch milliseconds.
 * @param timeZone - IANA zone used to format the calendar day.
 * @returns the local calendar key.
 */
export function zonedDayKey(time: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time))
  return [
    calendarPart(parts, 'year', '1970'),
    calendarPart(parts, 'month', '01'),
    calendarPart(parts, 'day', '01'),
  ].join('-')
}

function shiftUtcDay(day: string, delta: number): string {
  const time = Date.parse(day + 'T00:00:00.000Z')
  return new Date(time + delta * 86400000).toISOString().slice(0, 10)
}

/**
 * Rebase one UTC calendar row onto an IANA zone.
 * A UTC day that straddles two local days is attributed to the local day that
 * contains that UTC midnight.
 * @param row - UTC day totals from the sessionUsage fold.
 * @param timeZone - caller IANA zone.
 * @returns the same totals under the local calendar key.
 */
export function rebaseUsageDay(row: SessionUsageDay, timeZone: string): SessionUsageDay {
  const midnight = Date.parse(row.day + 'T00:00:00.000Z')
  if (!Number.isFinite(midnight)) throw new RangeError('invalid UTC day')
  return { ...row, day: zonedDayKey(midnight, timeZone) }
}

type DayAccumulator = {
  tokens: number
  durationMs: number
  models: Record<string, number>
}

function mergeDay(target: Record<string, DayAccumulator>, row: SessionUsageDay): void {
  const current = target[row.day] ?? { tokens: 0, durationMs: 0, models: {} }
  const models = { ...current.models }
  for (const [model, tokens] of Object.entries(row.models)) {
    models[model] = (models[model] ?? 0) + tokens
  }
  target[row.day] = {
    tokens: current.tokens + row.tokens,
    durationMs: current.durationMs + row.durationMs,
    models,
  }
}

function streakFrom(sortedDays: readonly string[], today: string): { current: number; longest: number } {
  if (sortedDays.length === 0) return { current: 0, longest: 0 }
  let longest = 1
  let run = 1
  for (let index = 1; index < sortedDays.length; index += 1) {
    run = sortedDays[index] === shiftUtcDay(previousDay(sortedDays, index), 1) ? run + 1 : 1
    if (run > longest) longest = run
  }
  const last = sortedDays[sortedDays.length - 1] ?? today
  if (last !== today && last !== shiftUtcDay(today, -1)) return { current: 0, longest }
  let current = 1
  for (let index = sortedDays.length - 1; index > 0; index -= 1) {
    if (sortedDays[index] !== shiftUtcDay(previousDay(sortedDays, index), 1)) break
    current += 1
  }
  return { current, longest }
}

/** One Host-wide usage snapshot served to the Settings page. */
export interface UsageOverview {
  readonly tokens: number
  readonly peakTokens: number
  readonly durationMs: number
  readonly peakDurationMs: number
  readonly currentStreakDays: number
  readonly longestStreakDays: number
  readonly firstActivityAt: number | null
  readonly lastActivityAt: number | null
  readonly days: readonly SessionUsageDay[]
  readonly models: readonly { readonly model: string; readonly tokens: number }[]
}

/**
 * Sum every session usage view onto the caller calendar.
 * @param sessions - whole-log usage views, typically one per visible Session.
 * @param timeZone - caller IANA zone used for calendar keys and streaks.
 * @param now - epoch millisecond used as today for the current streak.
 * @returns Host-wide totals, calendar rows, and model shares.
 */
export function aggregateUsage(
  sessions: readonly SessionUsageProjection[],
  timeZone: string,
  now: number,
): UsageOverview {
  const days: Record<string, DayAccumulator> = {}
  const models: Record<string, number> = {}
  let tokens = 0
  let peakTokens = 0
  let durationMs = 0
  let peakDurationMs = 0
  let firstActivityAt: number | null = null
  let lastActivityAt: number | null = null
  for (const session of sessions) {
    tokens += session.tokens
    peakTokens = Math.max(peakTokens, session.peakTokens)
    durationMs += session.durationMs
    peakDurationMs = Math.max(peakDurationMs, session.peakDurationMs)
    if (session.firstActivityAt !== null) {
      firstActivityAt = firstActivityAt === null
        ? session.firstActivityAt
        : Math.min(firstActivityAt, session.firstActivityAt)
    }
    if (session.lastActivityAt !== null) {
      lastActivityAt = lastActivityAt === null
        ? session.lastActivityAt
        : Math.max(lastActivityAt, session.lastActivityAt)
    }
    for (const row of session.days) mergeDay(days, rebaseUsageDay(row, timeZone))
    for (const row of session.models) models[row.model] = (models[row.model] ?? 0) + row.tokens
  }
  const dayRows = Object.entries(days)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, row]) => ({
      day,
      tokens: row.tokens,
      durationMs: row.durationMs,
      models: row.models,
    }))
  const streaks = streakFrom(dayRows.map(row => row.day), zonedDayKey(now, timeZone))
  const ranked = Object.entries(models)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([model, count]) => ({ model, tokens: count }))
  return {
    tokens,
    peakTokens,
    durationMs,
    peakDurationMs,
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    firstActivityAt,
    lastActivityAt,
    days: dayRows,
    models: ranked,
  }
}
