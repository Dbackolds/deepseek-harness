/**
 * Presentation helpers for Host Automation rules: selector summary, next-fire
 * instant, and the create-form draft that becomes one wire selector.
 */

import type { AutomationKey } from './locales.ts'
import type { AutomationCreateInput, AutomationRuleView } from './store.ts'

/** Translate function over this package's dictionary. */
export type AutomationTranslate = (key: AutomationKey, vars?: Record<string, string | number>) => string

/** Closed create-form schedule kinds matching the Host selector union. */
export type ScheduleKind = 'after' | 'at' | 'every' | 'clock'

/** Draft fields the create form owns. */
export interface AutomationDraft {
  name: string
  task: string
  workspaceId: string
  schedule: ScheduleKind
  afterSeconds: string
  at: string
  everySeconds: string
  clockTime: string
  clockZone: string
  weekdays: readonly number[]
  onOverlap: 'skip' | 'replace'
}

/** Empty create draft. `clockZone` is filled by the form from the browser. */
export const EMPTY_DRAFT: AutomationDraft = {
  name: '',
  task: '',
  workspaceId: '',
  schedule: 'after',
  afterSeconds: '60',
  at: '',
  everySeconds: '300',
  clockTime: '09:00',
  clockZone: '',
  weekdays: [],
  onOverlap: 'skip',
}

const WEEKDAY_KEYS = [
  'weekday.1',
  'weekday.2',
  'weekday.3',
  'weekday.4',
  'weekday.5',
  'weekday.6',
  'weekday.7',
] as const satisfies readonly AutomationKey[]

/**
 * Summarize a stored selector for the rule row.
 * @param selector - the durable selector the list RPC returned.
 * @param t - package translator.
 * @returns a one-line schedule summary.
 */
export function formatSelector(selector: unknown, t: AutomationTranslate): string {
  if (selector === null || typeof selector !== 'object') return t('selector.at')
  const record = selector as { kind?: unknown; afterSeconds?: unknown; everySeconds?: unknown; time?: unknown; weekdays?: unknown }
  switch (record.kind) {
    case 'after':
      return t('selector.after', { seconds: Number(record.afterSeconds) })
    case 'every':
      return t('selector.every', { seconds: Number(record.everySeconds) })
    case 'local-clock': {
      const time = typeof record.time === 'string' ? record.time : ''
      const days = Array.isArray(record.weekdays)
        ? record.weekdays
          .filter((day): day is number => typeof day === 'number' && day >= 1 && day <= 7)
          .flatMap((day) => {
            const key = WEEKDAY_KEYS[day - 1]
            /* v8 ignore next -- the 1–7 filter already closed the index */
            return key === undefined ? [] : [t(key)]
          })
          .join(' ')
        : ''
      return days.length === 0 ? t('selector.clock', { time }) : t('selector.clock.days', { days, time })
    }
    case 'at':
      return t('selector.at')
    default:
      return t('selector.at')
  }
}

/**
 * Format a UTC instant in the browser's locale without following the UI
 * language for the calendar itself — the Host stores UTC.
 * @param iso - UTC instant from the wire.
 * @returns a short local display, or the raw string when parsing fails.
 */
export function formatNextAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * State word for a rule row.
 * @param state - derived delivery state.
 * @param t - package translator.
 * @returns the localized state word.
 */
export function formatState(state: AutomationRuleView['state'], t: AutomationTranslate): string {
  switch (state) {
    case 'scheduled': return t('state.scheduled')
    case 'overdue': return t('state.overdue')
    case 'disabled': return t('state.disabled')
    /* v8 ignore next 4 -- closed delivery-state union */
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/**
 * Validate the create draft and build the wire payload.
 * @param draft - form fields.
 * @param t - package translator.
 * @returns the create payload, or a localized validation message.
 */
export function draftToCreate(draft: AutomationDraft, t: AutomationTranslate):
  | { ok: true; input: AutomationCreateInput }
  | { ok: false; error: string } {
  const task = draft.task.trim()
  if (task.length === 0) return { ok: false, error: t('needTask') }
  if (draft.workspaceId.length === 0) return { ok: false, error: t('needWorkspace') }
  const name = draft.name.trim()
  const base = {
    task,
    workspaceId: draft.workspaceId as AutomationCreateInput['workspaceId'],
    onOverlap: draft.onOverlap,
    ...name.length === 0 ? {} : { name },
  }
  switch (draft.schedule) {
    case 'after': {
      const afterSeconds = Number.parseInt(draft.afterSeconds, 10)
      if (!Number.isInteger(afterSeconds) || afterSeconds < 1) return { ok: false, error: t('needAfter') }
      return { ok: true, input: { ...base, afterSeconds } }
    }
    case 'at': {
      const at = draft.at.trim()
      if (at.length === 0) return { ok: false, error: t('needAt') }
      return { ok: true, input: { ...base, at } }
    }
    case 'every': {
      const everySeconds = Number.parseInt(draft.everySeconds, 10)
      if (!Number.isInteger(everySeconds) || everySeconds < 300) return { ok: false, error: t('needEvery') }
      return { ok: true, input: { ...base, everySeconds } }
    }
    case 'clock': {
      const time = draft.clockTime.trim()
      const time_zone = draft.clockZone.trim()
      if (time.length === 0 || time_zone.length === 0) return { ok: false, error: t('needClock') }
      return {
        ok: true,
        input: {
          ...base,
          localClock: {
            time,
            time_zone,
            ...draft.weekdays.length === 0 ? {} : { weekdays: [...draft.weekdays] },
          },
        },
      }
    }
    /* v8 ignore next 4 -- closed schedule-kind union */
    default: {
      const exhaustive: never = draft.schedule
      return exhaustive
    }
  }
}

/**
 * Toggle one ISO weekday in the draft's weekday list, keeping 1–7 order.
 * @param weekdays - current selection.
 * @param day - ISO weekday, 1 = Monday.
 * @returns the next selection.
 */
export function toggleWeekday(weekdays: readonly number[], day: number): number[] {
  const next = weekdays.includes(day)
    ? weekdays.filter(value => value !== day)
    : [...weekdays, day]
  return next.sort((left, right) => left - right)
}
