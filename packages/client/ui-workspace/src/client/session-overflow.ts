/**
 * Pure Session overflow math for the sidebar browser: a Settings-owned step
 * bounds each local Show more click, and Expand all leaves the list unfolded.
 */
import {
  SESSION_OVERFLOW_ALL, type SessionOverflowLimit,
} from '../workspace-settings.ts'

export {
  DEFAULT_SESSION_OVERFLOW_LIMIT, SESSION_OVERFLOW_ALL, SESSION_OVERFLOW_FIELD,
  SESSION_OVERFLOW_LIMITS, WORKSPACE_SETTINGS_NAMESPACE, type SessionOverflowLimit,
  type WorkspaceSettings,
} from '../workspace-settings.ts'

/**
 * Resolve the ordinary-row base limit for one overflow preference.
 * @param limit - Settings-owned overflow preference.
 * @returns finite base limit, or `null` when every row stays visible.
 */
export function sessionOverflowBaseLimit(limit: SessionOverflowLimit): number | null {
  return limit === SESSION_OVERFLOW_ALL ? null : limit
}

/**
 * Resolve how many ordinary rows one Show more click should reveal.
 * @param limit - Settings-owned overflow preference.
 * @returns finite step size, or `null` when overflow controls are off.
 */
export function sessionOverflowStep(limit: SessionOverflowLimit): number | null {
  return sessionOverflowBaseLimit(limit)
}

/**
 * Resolve the ordinary-row limit currently applied to one account.
 * @param stored - absolute limit stored for this mount, when the user already expanded.
 * @param preference - Settings-owned overflow preference.
 * @returns finite visible limit, or `null` when every row stays visible.
 */
export function resolvedSessionOverflowLimit(
  stored: number | undefined,
  preference: SessionOverflowLimit,
): number | null {
  const base = sessionOverflowBaseLimit(preference)
  if (base === null) return null
  if (stored === undefined) return base
  return Math.max(base, stored)
}

/**
 * Count how many ordinary rows the next Show more click will reveal.
 * @param visibleLimit - ordinary rows currently shown.
 * @param step - Settings-owned step size.
 * @param totalOrdinary - ordinary rows in the folded cluster.
 * @returns rows revealed by the next click (zero when already fully shown).
 */
export function sessionOverflowRevealCount(
  visibleLimit: number,
  step: number,
  totalOrdinary: number,
): number {
  return Math.max(0, Math.min(step, totalOrdinary - visibleLimit))
}

/**
 * Advance one account's ordinary-row limit by the Settings-owned step.
 * @param visibleLimit - ordinary rows currently shown.
 * @param step - Settings-owned step size.
 * @param totalOrdinary - ordinary rows in the folded cluster.
 * @returns the next absolute ordinary-row limit.
 */
export function nextSessionOverflowLimit(
  visibleLimit: number,
  step: number,
  totalOrdinary: number,
): number {
  return Math.min(totalOrdinary, visibleLimit + step)
}

/**
 * Whether one account currently shows more ordinary rows than the Settings-owned base.
 * @param stored - absolute limit stored for this mount, when the user already expanded.
 * @param preference - Settings-owned overflow preference.
 * @returns true when Show less can restore the folded base projection.
 */
export function sessionOverflowCanCollapse(
  stored: number | undefined,
  preference: SessionOverflowLimit,
): boolean {
  const base = sessionOverflowBaseLimit(preference)
  return base !== null && stored !== undefined && stored > base
}

/**
 * Count ordinary (non-blank) rows that charge against the overflow quota.
 * @param sessions - rows in the folded cluster.
 * @returns ordinary-row count.
 */
export function ordinarySessionCount(
  sessions: readonly { blank?: boolean }[],
): number {
  let count = 0
  for (const session of sessions) {
    if (!session.blank) count += 1
  }
  return count
}
