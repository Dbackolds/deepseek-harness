import { describe, it } from 'vitest'
import { updatedAgo, updatedAgoLine, updatedAgoRelative } from '../../src/client/updated-ago.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const now = Date.parse('2026-08-17T12:00:00.000Z')
const t = (key: string, params?: Record<string, unknown>): string => {
  if (key === 'updatedAt') return `上次更新时间: ${String(params?.relative)}`
  if (key === 'updatedAgoDays') return `${String(params?.days)} 天前`
  if (key === 'updatedAgoHoursMinutes') return `${String(params?.hours)} 小时 ${String(params?.minutes)} 分前`
  throw new Error(key)
}

assert(updatedAgo(undefined, now) === undefined, 'missing stamp')
assert(updatedAgo('not-a-date', now) === undefined, 'invalid stamp')
assert(
  JSON.stringify(updatedAgo('2026-08-14T12:00:00.000Z', now)) === JSON.stringify({ unit: 'days', days: 3 }),
  'full days',
)
assert(
  JSON.stringify(updatedAgo('2026-08-17T06:48:00.000Z', now))
    === JSON.stringify({ unit: 'hoursMinutes', hours: 5, minutes: 12 }),
  'hours and minutes',
)
assert(
  JSON.stringify(updatedAgo('2026-08-17T11:20:00.000Z', now))
    === JSON.stringify({ unit: 'hoursMinutes', hours: 0, minutes: 40 }),
  'minutes only still keep hours',
)
assert(
  JSON.stringify(updatedAgo('2026-08-17T12:00:30.000Z', now))
    === JSON.stringify({ unit: 'hoursMinutes', hours: 0, minutes: 0 }),
  'future or same instant clamps to zero',
)
assert(updatedAgoRelative(t, '2026-08-14T12:00:00.000Z', now) === '3 天前', 'relative days')
assert(updatedAgoRelative(t, '2026-08-17T06:48:00.000Z', now) === '5 小时 12 分前', 'relative hours minutes')
assert(updatedAgoLine(t, '2026-08-14T12:00:00.000Z', now) === '上次更新时间: 3 天前', 'card line days')
assert(updatedAgoLine(t, '2026-08-17T06:48:00.000Z', now) === '上次更新时间: 5 小时 12 分前', 'card line hours minutes')
assert(updatedAgoLine(t, undefined, now) === undefined, 'no line without a stamp')


describe('updated-ago', () => {
  it('holds the imported assertions', () => {})
})
