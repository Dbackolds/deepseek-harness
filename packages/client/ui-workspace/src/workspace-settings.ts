/** Sidebar session-overflow preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the workspace plugin. */
export const WORKSPACE_SETTINGS_NAMESPACE = 'ui-workspace'

/** Field carrying the Session overflow step (or expand-all). */
export const SESSION_OVERFLOW_FIELD = 'sessionOverflowLimit'

/** Discrete overflow steps offered by the Settings row. */
export const SESSION_OVERFLOW_LIMITS = [5, 10, 20, 50] as const

/** Expand every idle/History row without a local overflow control. */
export const SESSION_OVERFLOW_ALL = 'all' as const

/** Configurable overflow step accepted at settings and browser boundaries. */
export type SessionOverflowLimit =
  | typeof SESSION_OVERFLOW_LIMITS[number]
  | typeof SESSION_OVERFLOW_ALL

/** Default keeps the historical five-row folded projection. */
export const DEFAULT_SESSION_OVERFLOW_LIMIT: SessionOverflowLimit = 5

/** Durable workspace section shared by the Host schema and the browser scope. */
export interface WorkspaceSettings {
  /**
   * Ordinary idle/History rows revealed per overflow click, or {@link SESSION_OVERFLOW_ALL}
   * to leave those rows unfolded.
   */
  sessionOverflowLimit: SessionOverflowLimit
}

/** Durable workspace schema; also the wire envelope the browser scope validates against. */
export const WorkspaceSettingsSchema: z<WorkspaceSettings> = z.object({
  [SESSION_OVERFLOW_FIELD]: z.union([
    SESSION_OVERFLOW_ALL,
    ...SESSION_OVERFLOW_LIMITS,
  ]).default(DEFAULT_SESSION_OVERFLOW_LIMIT),
})

/**
 * Narrow one wire or registry value to a persistable overflow limit.
 * @param value - value crossing the settings boundary.
 * @returns whether the value is a supported overflow limit.
 */
export function isSessionOverflowLimit(value: unknown): value is SessionOverflowLimit {
  if (value === SESSION_OVERFLOW_ALL) return true
  return SESSION_OVERFLOW_LIMITS.some(limit => limit === value)
}
