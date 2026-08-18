/** Relative age of a catalog listing's pinned npm publish time. */
export type UpdatedAgo =
  | { readonly unit: 'days'; readonly days: number }
  | { readonly unit: 'hoursMinutes'; readonly hours: number; readonly minutes: number }

/**
 * Bucket a listing's last update for display.
 * A full day or more is days only. Less than a day is hours and minutes.
 * @param updatedAt - UTC ISO-8601 publish time, or missing.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns the display bucket, or undefined when the stamp is missing or invalid.
 */
export function updatedAgo(updatedAt: string | undefined, now: number): UpdatedAgo | undefined {
  if (updatedAt === undefined) return undefined
  const then = Date.parse(updatedAt)
  if (!Number.isFinite(then)) return undefined
  const DAY = 86_400_000
  const HOUR = 3_600_000
  const MIN = 60_000
  const diff = Math.max(0, now - then)
  if (diff >= DAY) return { unit: 'days', days: Math.floor(diff / DAY) }
  return {
    unit: 'hoursMinutes',
    hours: Math.floor(diff / HOUR),
    minutes: Math.floor((diff % HOUR) / MIN),
  }
}

/** Locale keys the relative-time line uses. */
export type UpdatedAgoLocaleKey = 'updatedAt' | 'updatedAtLabel' | 'updatedAgoDays' | 'updatedAgoHoursMinutes'

/**
 * Localize the relative age without the "last updated" prefix.
 * @param t - locale reader for the marketplace namespace.
 * @param updatedAt - UTC ISO-8601 publish time, or missing.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns "3 天前" / "5 小时 12 分前", or undefined when there is no stamp.
 */
export function updatedAgoRelative(
  t: (key: UpdatedAgoLocaleKey, params?: Record<string, unknown>) => string,
  updatedAt: string | undefined,
  now: number,
): string | undefined {
  const ago = updatedAgo(updatedAt, now)
  if (ago === undefined) return undefined
  return ago.unit === 'days'
    ? t('updatedAgoDays', { days: ago.days })
    : t('updatedAgoHoursMinutes', { hours: ago.hours, minutes: ago.minutes })
}

/**
 * Localize the card line that names how long ago the listing was published.
 * @param t - locale reader for the marketplace namespace.
 * @param updatedAt - UTC ISO-8601 publish time, or missing.
 * @param now - current epoch ms (injected for pure rendering).
 * @returns "上次更新时间: 3 天前", or undefined when there is no stamp.
 */
export function updatedAgoLine(
  t: (key: UpdatedAgoLocaleKey, params?: Record<string, unknown>) => string,
  updatedAt: string | undefined,
  now: number,
): string | undefined {
  const relative = updatedAgoRelative(t, updatedAt, now)
  return relative === undefined ? undefined : t('updatedAt', { relative })
}
