import type { UsageDay, UsageOverviewValue } from '@deepseek-ai/dsh-api-remotes/client'
import type { UsageSettingsKey } from './locales.ts'

/** Locale reader used by compact number and duration formatters. */
export type Translate = (key: UsageSettingsKey, params?: Record<string, string | number>) => string

/** Semantic chart colors cycled across model series. */
export const MODEL_COLORS = [
  'var(--dsw-alias-state-business-primary)',
  'var(--dsw-alias-state-success-primary)',
  'var(--dsw-alias-state-warn-primary)',
  'var(--dsw-alias-state-error-secondary)',
  'var(--dsw-alias-label-tertiary)',
] as const

/**
 * Format a token count with locale-owned compact units.
 * @param value - raw token count.
 * @param t - locale reader.
 * @param chinese - when true, use wan/yi instead of K/M.
 * @returns a compact display string.
 */
export function formatCompactNumber(value: number, t: Translate, chinese = false): string {
  const scaled = (candidate: number): string => String(Math.round(candidate * 10) / 10)
  if (chinese) {
    if (value < 10000) return String(value)
    if (value < 100000000) return t('number.wan', { value: scaled(value / 10000) })
    return t('number.yi', { value: scaled(value / 100000000) })
  }
  if (value < 1000) return String(value)
  if (value < 1000000) return t('number.thousand', { value: scaled(value / 1000) })
  return t('number.million', { value: scaled(value / 1000000) })
}

/**
 * Format milliseconds as hours and minutes.
 * @param ms - duration in milliseconds.
 * @param t - locale reader.
 * @returns a localized duration string.
 */
export function formatDuration(ms: number, t: Translate): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return t('minutesOnly', { minutes })
  return t('hoursMinutes', { hours, minutes })
}

/**
 * Shift a YYYY-MM-DD calendar day by a signed day count.
 * @param day - UTC calendar day.
 * @param delta - days to add.
 * @returns the shifted calendar day.
 */
export function shiftDay(day: string, delta: number): string {
  const time = Date.parse(day + 'T00:00:00.000Z')
  return new Date(time + delta * 86400000).toISOString().slice(0, 10)
}

/**
 * Localized month label for a calendar day.
 * @param day - YYYY-MM-DD.
 * @param t - locale reader.
 * @returns the month label.
 */
export function monthLabel(day: string, t: Translate): string {
  const month = Number(day.slice(5, 7)) as 1|2|3|4|5|6|7|8|9|10|11|12
  return t(('month.' + month) as UsageSettingsKey)
}

/**
 * Short month/day axis label.
 * @param day - YYYY-MM-DD.
 * @returns M/D.
 */
export function dayLabel(day: string): string {
  return Number(day.slice(5, 7)) + '/' + Number(day.slice(8, 10))
}

/**
 * Inclusive calendar range.
 * @param from - first YYYY-MM-DD.
 * @param to - last YYYY-MM-DD.
 * @returns every day from the start through the end.
 */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = []
  let cursor = from
  while (cursor <= to) { days.push(cursor); cursor = shiftDay(cursor, 1) }
  return days
}

/**
 * Monday of the ISO week that contains the given day.
 * @param day - YYYY-MM-DD.
 * @returns the week-start YYYY-MM-DD.
 */
export function isoWeekStart(day: string): string {
  const date = new Date(day + 'T00:00:00.000Z')
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
  return shiftDay(day, 1 - weekday)
}

/** Heatmap bucket mode. */
export type ActivityMode = 'daily' | 'weekly' | 'cumulative'
/** Trend window length in days. */
export type RangeDays = 7 | 30

/**
 * Expand usage days into a 364-day heatmap series.
 * @param days - sparse usage rows.
 * @param mode - daily, weekly, or running total.
 * @param endDay - inclusive last calendar day.
 * @returns one cell per day.
 */
export function heatmapCells(days: readonly UsageDay[], mode: ActivityMode, endDay: string): { day: string; tokens: number }[] {
  const start = shiftDay(endDay, -363)
  const byDay = new Map(days.map(row => [row.day, row.tokens]))
  const cells = enumerateDays(start, endDay).map(day => ({ day, tokens: byDay.get(day) ?? 0 }))
  if (mode === 'daily') return cells
  if (mode === 'weekly') {
    const weeks = new Map<string, number>()
    for (const cell of cells) {
      const week = isoWeekStart(cell.day)
      weeks.set(week, (weeks.get(week) ?? 0) + cell.tokens)
    }
    return cells.map(cell => ({ day: cell.day, tokens: weeks.get(isoWeekStart(cell.day)) ?? 0 }))
  }
  let running = 0
  return cells.map((cell) => { running += cell.tokens; return { day: cell.day, tokens: running } })
}

/**
 * Map a token count onto a 0-4 heatmap intensity.
 * @param tokens - cell tokens.
 * @param peak - maximum tokens in the heatmap.
 * @returns intensity bucket.
 */
export function heatmapLevel(tokens: number, peak: number): 0|1|2|3|4 {
  if (tokens <= 0 || peak <= 0) return 0
  const ratio = tokens / peak
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Fill a contiguous trend window.
 * @param days - sparse usage rows.
 * @param range - 7 or 30.
 * @param endDay - inclusive last calendar day.
 * @returns one row per day in the window.
 */
export function trendDays(days: readonly UsageDay[], range: RangeDays, endDay: string): UsageDay[] {
  const start = shiftDay(endDay, 1 - range)
  const byDay = new Map(days.map(row => [row.day, row]))
  return enumerateDays(start, endDay).map(day => byDay.get(day) ?? { day, tokens: 0, durationMs: 0, models: {} })
}

/**
 * Chart color for a model series index.
 * @param index - zero-based series index.
 * @returns a CSS color token.
 */
export function modelColor(index: number): string {
  return MODEL_COLORS[index % MODEL_COLORS.length] ?? MODEL_COLORS[0]
}

/**
 * Donut slices from Host-wide model shares.
 * @param models - ranked model rows.
 * @returns percent slices with colors.
 */
export function donutSegments(models: UsageOverviewValue['models']): { model: string; tokens: number; color: string; percent: number }[] {
  const total = models.reduce((sum, row) => sum + row.tokens, 0)
  if (total === 0) return []
  return models.map((row, index) => ({
    model: row.model,
    tokens: row.tokens,
    color: modelColor(index),
    percent: Math.round((row.tokens / total) * 100),
  }))
}

/**
 * SVG polyline points for one series.
 * @param values - y values.
 * @param width - chart width.
 * @param height - chart height.
 * @returns space-separated x,y pairs.
 */
export function polyline(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const peak = Math.max(1, ...values)
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = height - (value / peak) * height
    return x.toFixed(2) + ',' + y.toFixed(2)
  }).join(' ')
}
