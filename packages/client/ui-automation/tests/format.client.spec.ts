/** Selector summaries and create-draft validation. */
import { describe, expect, it } from 'vitest'
import {
  draftToCreate, EMPTY_DRAFT, formatNextAt, formatSelector, formatState, toggleWeekday,
} from '../src/client/format.ts'
import { en } from '../src/client/locales.ts'

const t = (key: keyof typeof en, vars?: Record<string, string | number>): string => {
  let text: string = en[key]
  if (vars === undefined) return text
  for (const [name, value] of Object.entries(vars)) text = text.replace('{' + name + '}', String(value))
  return text
}

describe('formatSelector', () => {
  it('summarizes each stored selector kind', () => {
    expect(formatSelector({ kind: 'after', afterSeconds: 90 }, t)).toBe('Once in 90s')
    expect(formatSelector({ kind: 'every', everySeconds: 300 }, t)).toBe('Every 300s')
    expect(formatSelector({ kind: 'at' }, t)).toBe('Once at a set time')
    expect(formatSelector({ kind: 'local-clock', time: '09:00', timeZone: 'UTC' }, t)).toBe('Daily at 09:00')
    expect(formatSelector({ kind: 'local-clock', time: '09:00', timeZone: 'UTC', weekdays: [1, 5] }, t)).toBe('Mon Fri at 09:00')
    expect(formatSelector({ kind: 'local-clock', timeZone: 'UTC', weekdays: ['x', 0, 8] }, t)).toBe('Daily at ')
  })

  it('falls back for an unknown selector', () => {
    expect(formatSelector(null, t)).toBe('Once at a set time')
    expect(formatSelector({ kind: 'cron' }, t)).toBe('Once at a set time')
  })
})

describe('formatNextAt and formatState', () => {
  it('formats a UTC instant and returns the raw string when parsing fails', () => {
    expect(formatNextAt('not-a-date')).toBe('not-a-date')
    expect(formatNextAt('2026-08-15T12:01:00.000Z')).toMatch(/2026/)
  })

  it('names each delivery state', () => {
    expect(formatState('scheduled', t)).toBe('Scheduled')
    expect(formatState('overdue', t)).toBe('Overdue')
    expect(formatState('disabled', t)).toBe('Disabled')
  })
})

describe('draftToCreate', () => {
  const base = { ...EMPTY_DRAFT, task: 'ping', workspaceId: 'ws-1' }

  it('rejects a blank task or workspace', () => {
    expect(draftToCreate({ ...base, task: '  ' }, t)).toEqual({ ok: false, error: 'Enter a task.' })
    expect(draftToCreate({ ...base, workspaceId: '' }, t)).toEqual({ ok: false, error: 'Choose a workspace.' })
  })

  it('builds each selector and optional name', () => {
    expect(draftToCreate({ ...base, name: '  morning  ', afterSeconds: '45' }, t)).toEqual({
      ok: true,
      input: { name: 'morning', task: 'ping', workspaceId: 'ws-1', onOverlap: 'skip', afterSeconds: 45 },
    })
    expect(draftToCreate({ ...base, schedule: 'at', at: '2026-08-16T09:00:00.000Z' }, t)).toEqual({
      ok: true,
      input: { task: 'ping', workspaceId: 'ws-1', onOverlap: 'skip', at: '2026-08-16T09:00:00.000Z' },
    })
    expect(draftToCreate({ ...base, schedule: 'every', everySeconds: '600' }, t)).toEqual({
      ok: true,
      input: { task: 'ping', workspaceId: 'ws-1', onOverlap: 'skip', everySeconds: 600 },
    })
    expect(draftToCreate({
      ...base, schedule: 'clock', clockTime: '09:30', clockZone: 'Asia/Shanghai', weekdays: [],
    }, t)).toEqual({
      ok: true,
      input: {
        task: 'ping',
        workspaceId: 'ws-1',
        onOverlap: 'skip',
        localClock: { time: '09:30', time_zone: 'Asia/Shanghai' },
      },
    })
    expect(draftToCreate({
      ...base, schedule: 'clock', clockTime: '09:30', clockZone: 'Asia/Shanghai', weekdays: [1, 2],
    }, t)).toEqual({
      ok: true,
      input: {
        task: 'ping',
        workspaceId: 'ws-1',
        onOverlap: 'skip',
        localClock: { time: '09:30', time_zone: 'Asia/Shanghai', weekdays: [1, 2] },
      },
    })
  })

  it('rejects invalid selector fields', () => {
    expect(draftToCreate({ ...base, afterSeconds: '0' }, t).ok).toBe(false)
    expect(draftToCreate({ ...base, schedule: 'at', at: '' }, t).ok).toBe(false)
    expect(draftToCreate({ ...base, schedule: 'every', everySeconds: '299' }, t).ok).toBe(false)
    expect(draftToCreate({ ...base, schedule: 'clock', clockTime: '', clockZone: 'UTC' }, t).ok).toBe(false)
  })
})

describe('toggleWeekday', () => {
  it('adds and removes ISO weekdays in order', () => {
    expect(toggleWeekday([5], 1)).toEqual([1, 5])
    expect(toggleWeekday([1, 5], 1)).toEqual([5])
  })
})
