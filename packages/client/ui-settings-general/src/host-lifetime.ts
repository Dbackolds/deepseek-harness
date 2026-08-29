/**
 * Durable Host-process start count and the current process start instant.
 * @module @deepseek-ai/dsh-client-ui-settings-general
 */

import z from '@deepseek-ai/schemastery'

/** Settings namespace for Host-process lifetime facts. */
export const HOST_LIFETIME_SETTINGS_NAMESPACE = 'ui-host'

/** Field holding how many times this Host home has started a process. */
export const HOST_START_COUNT_FIELD = 'startCount'

/** Field holding the current process start as a UTC instant. */
export const HOST_STARTED_AT_FIELD = 'startedAt'

/** Durable Host-lifetime section. */
export interface HostLifetimeSettings {
  /** How many Host processes this home has started. */
  startCount: number
  /** Current process start as a four-digit-year UTC instant. */
  startedAt?: string
}

/** Schema for the Host-lifetime section. */
export const HostLifetimeSettingsSchema: z<HostLifetimeSettings> = z.object({
  [HOST_START_COUNT_FIELD]: z.number().step(1).min(0).default(0),
  [HOST_STARTED_AT_FIELD]: z.string().default(''),
})

const PROCESS = globalThis as typeof globalThis & {
  __dshHostProcessStartedAt?: number
  __dshHostProcessStartCounted?: boolean
}

/** Substitutable process clock and once-per-process flags for tests. */
export const internals = {
  now: () => Date.now(),
  resetProcess: (): void => {
    delete PROCESS.__dshHostProcessStartedAt
    delete PROCESS.__dshHostProcessStartCounted
  },
}

/**
 * Epoch millisecond instant this Node process first loaded this module.
 * @returns the process start epoch.
 */
export function hostProcessStartedAt(): number {
  PROCESS.__dshHostProcessStartedAt ??= internals.now()
  return PROCESS.__dshHostProcessStartedAt
}

/**
 * Whether this process still needs its durable start-count increment.
 * @returns true once per process.
 */
export function consumeHostProcessStartCount(): boolean {
  if (PROCESS.__dshHostProcessStartCounted === true) return false
  PROCESS.__dshHostProcessStartCounted = true
  return true
}

/**
 * Format one epoch as a canonical UTC instant.
 * @param epoch - process start epoch.
 * @returns RFC 3339 UTC instant with milliseconds.
 */
export function formatHostStartedAt(epoch: number): string {
  return new Date(epoch).toISOString()
}

/**
 * Next durable start count after this process's first increment.
 * @param current - stored count, or 0 when absent.
 * @returns the incremented count.
 */
export function nextHostStartCount(current: number): number {
  if (!Number.isSafeInteger(current) || current < 0) return 1
  return current + 1
}
