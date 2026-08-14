/**
 * Strict Automation time validation and next-target arithmetic.
 * @module @deepseek-ai/dsh-automation
 */
import { AutomationInputError } from './errors.ts'
/** Fixed v1 lower bound for a fixed-rate rule. */
export const MIN_EVERY_INTERVAL_SECONDS = 300
const MIN_FOUR_DIGIT_YEAR_MS = Date.parse('0001-01-01T00:00:00.000Z')
const MAX_FOUR_DIGIT_YEAR_MS = Date.parse('9999-12-31T23:59:59.999Z')
const UTC_INSTANT = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:\d{2}\.\d{3}Z$/
const OFFSET_INSTANT = new RegExp(String.raw `^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`
    + String.raw `T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})`
    + String.raw `(?:\.(?<fraction>\d{1,3}))?(?<zone>Z|(?<sign>[+-])`
    + String.raw `(?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$`)
const LOCAL_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/
const LOCAL_TIME = /^(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d{1,3}))?$/
const LOCAL_CLOCK_TIME = /^(?<hour>\d{2}):(?<minute>\d{2})$/
const IANA_ZONE = /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+$/
const OFFSET_NAME = /^GMT(?:(?<sign>[+-])(?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2}))?)?$/
/** Whether an unknown value is a non-array object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
/** Read one required named regular-expression group as a number. */
function groupNumber(groups, name) {
  const value = groups[name]
  /* v8 ignore next -- successful fixed regexes always provide every requested group. */
  if (value === undefined)
    throw new AutomationInputError('invalid_selector', 'The at value has an invalid shape.')
  return Number(value)
}
/** Convert exact calendar fields to a UTC-shaped epoch while rejecting normalization. */
function calendarEpoch(parts) {
  const value = new Date(0)
  value.setUTCHours(0, 0, 0, 0)
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day)
  value.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond)
  const epoch = value.getTime()
  if (!Number.isFinite(epoch)
        || value.getUTCFullYear() !== parts.year
        || value.getUTCMonth() + 1 !== parts.month
        || value.getUTCDate() !== parts.day
        || value.getUTCHours() !== parts.hour
        || value.getUTCMinutes() !== parts.minute
        || value.getUTCSeconds() !== parts.second
        || value.getUTCMilliseconds() !== parts.millisecond) {
    throw new AutomationInputError('invalid_selector', 'The at value must be a real ISO calendar date and time.')
  }
  return epoch
}
/** Normalize an optional one-to-three digit fractional second to milliseconds. */
function milliseconds(value) {
  return value === undefined ? 0 : Number(value.padEnd(3, '0'))
}
/** Require a safe, representable, strictly future UTC target. */
export function futureInstant(epoch, now) {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(epoch)
        || epoch < MIN_FOUR_DIGIT_YEAR_MS || epoch > MAX_FOUR_DIGIT_YEAR_MS) {
    throw new AutomationInputError('time_out_of_range', 'The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.')
  }
  if (epoch <= now) {
    throw new AutomationInputError('not_future', 'The scheduled time must be strictly in the future.')
  }
  const instant = new Date(epoch).toISOString()
  /* v8 ignore next -- an in-range integral Date always formats as the canonical UTC profile. */
  if (!UTC_INSTANT.test(instant)) {
    throw new AutomationInputError('time_out_of_range', 'The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.')
  }
  return instant
}
/** Format one epoch as a canonical four-digit-year UTC instant. */
export function formatUtcInstant(epoch) {
  if (!Number.isSafeInteger(epoch) || epoch < MIN_FOUR_DIGIT_YEAR_MS || epoch > MAX_FOUR_DIGIT_YEAR_MS) {
    throw new AutomationInputError('time_out_of_range', 'The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.')
  }
  return new Date(epoch).toISOString()
}
/** Parse a strict RFC 3339 instant whose numeric offset is part of the input. */
function parseOffsetInstant(value) {
  const match = OFFSET_INSTANT.exec(value)
  const groups = match?.groups
  if (groups === undefined) {
    throw new AutomationInputError('invalid_selector', 'at must use YYYY-MM-DDTHH:mm:ss with optional 1-3 digit fractional seconds and an explicit Z or numeric offset.')
  }
  const parts = {
    year: groupNumber(groups, 'year'),
    month: groupNumber(groups, 'month'),
    day: groupNumber(groups, 'day'),
    hour: groupNumber(groups, 'hour'),
    minute: groupNumber(groups, 'minute'),
    second: groupNumber(groups, 'second'),
    millisecond: milliseconds(groups['fraction']),
  }
  if (parts.year === 0 || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new AutomationInputError('invalid_selector', 'The at value must be a real ISO calendar date and time.')
  }
  const localEpoch = calendarEpoch(parts)
  if (groups['zone'] === 'Z')
    return localEpoch
  const offsetHour = groupNumber(groups, 'offsetHour')
  const offsetMinute = groupNumber(groups, 'offsetMinute')
  if (offsetHour > 23 || offsetMinute > 59
        || (groups['sign'] === '-' && offsetHour === 0 && offsetMinute === 0)) {
    throw new AutomationInputError('invalid_selector', 'The at numeric offset is invalid.')
  }
  const direction = groups['sign'] === '+' ? 1 : -1
  return localEpoch - direction * (offsetHour * 60 + offsetMinute) * 60_000
}
/**
 * Validate and canonicalize one raw IANA time-zone selector.
 * @param value - Candidate `UTC` or IANA Area/Location name.
 * @returns The runtime's canonical IANA name.
 */
export function canonicalizeTimeZone(value) {
  if (value.length === 0 || value.trim() !== value || (value !== 'UTC' && !IANA_ZONE.test(value))) {
    throw new AutomationInputError('invalid_time_zone', 'time_zone must be UTC or a valid IANA Area/Location name.')
  }
  let canonical
  try {
    canonical = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
  }
  catch (error) {
    throw new AutomationInputError('invalid_time_zone', 'time_zone must be UTC or a valid IANA Area/Location name.', { cause: error })
  }
  /* v8 ignore next -- Intl returns the requested canonical zone or an IANA canonical alias. */
  if (canonical !== 'UTC' && !IANA_ZONE.test(canonical)) {
    throw new AutomationInputError('invalid_time_zone', 'time_zone must resolve to UTC or an IANA Area/Location name.')
  }
  return canonical
}
/** Parse strict local calendar fields without consulting a process time zone. */
function parseLocalAt(value) {
  const dateMatch = LOCAL_DATE.exec(value.date)
  const timeMatch = LOCAL_TIME.exec(value.time)
  const date = dateMatch?.groups
  const time = timeMatch?.groups
  if (date === undefined || time === undefined) {
    throw new AutomationInputError('invalid_selector', 'Local at requires date YYYY-MM-DD and time HH:mm:ss with optional one-to-three digit milliseconds.')
  }
  const parts = {
    year: groupNumber(date, 'year'),
    month: groupNumber(date, 'month'),
    day: groupNumber(date, 'day'),
    hour: groupNumber(time, 'hour'),
    minute: groupNumber(time, 'minute'),
    second: groupNumber(time, 'second'),
    millisecond: milliseconds(time['fraction']),
  }
  if (parts.year === 0 || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new AutomationInputError('invalid_selector', 'The local at value must be a real ISO calendar date and time.')
  }
  calendarEpoch(parts)
  return parts
}
/** Format one epoch into exact local fields and the zone offset that produced them. */
function localProjection(formatter, epoch) {
  const values = Object.fromEntries(formatter.formatToParts(epoch).map(part => [part.type, part.value]))
  const zoneName = values['timeZoneName']
  /* v8 ignore next -- a formatter configured with longOffset always emits this part. */
  const offsetMatch = typeof zoneName === 'string' ? OFFSET_NAME.exec(zoneName) : null
  const offsetGroups = offsetMatch?.groups
  /* v8 ignore next -- the formatter requested longOffset, whose part is defined by Intl. */
  if (offsetMatch === null || offsetGroups === undefined) {
    throw new AutomationInputError('invalid_time_zone', 'time_zone did not expose a usable UTC offset.')
  }
  const direction = offsetGroups['sign'] === '-' ? -1 : 1
  /* v8 ignore next -- some Intl builds spell UTC as bare GMT instead of GMT+00:00. */
  const offset = offsetGroups['sign'] === undefined
    ? 0
    : direction * (groupNumber(offsetGroups, 'hour') * 3600
            + groupNumber(offsetGroups, 'minute') * 60
            + Number(offsetGroups['second'] ?? '0')) * 1_000
  return {
    year: Number(values['year']),
    month: Number(values['month']),
    day: Number(values['day']),
    hour: Number(values['hour']),
    minute: Number(values['minute']),
    second: Number(values['second']),
    millisecond: Number(values['fractionalSecond']),
    offset,
  }
}
/** Resolve a local wall-clock value, choosing the first instant in an overlap and rejecting a gap. */
function resolveLocalInstant(parts, timeZone) {
  const localEpoch = calendarEpoch(parts)
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  })
  const offsets = new Set<number>()
  for (const delta of [-172_800_000, -86_400_000, 0, 86_400_000, 172_800_000]) {
    const sample = Math.min(MAX_FOUR_DIGIT_YEAR_MS, Math.max(MIN_FOUR_DIGIT_YEAR_MS, localEpoch + delta))
    offsets.add(localProjection(formatter, sample).offset)
  }
  const candidates: number[] = []
  let outOfRange = false
  for (const offset of offsets) {
    const candidate = localEpoch - offset
    if (candidate < MIN_FOUR_DIGIT_YEAR_MS || candidate > MAX_FOUR_DIGIT_YEAR_MS) {
      outOfRange = true
      continue
    }
    const projected = localProjection(formatter, candidate)
    if (projected.year === parts.year
            && projected.month === parts.month
            && projected.day === parts.day
            && projected.hour === parts.hour
            && projected.minute === parts.minute
            && projected.second === parts.second
            && projected.millisecond === parts.millisecond) {
      candidates.push(candidate)
    }
  }
  const first = candidates.sort((left, right) => left - right)[0]
  if (first === undefined) {
    if (outOfRange) {
      throw new AutomationInputError('time_out_of_range', 'The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.')
    }
    throw new AutomationInputError('invalid_selector', 'The local at time does not exist in the selected time zone.')
  }
  return first
}
/** Resolve one `at` input to a strictly future UTC instant. */
export function resolveAtInstant(value, now) {
  if (typeof value === 'string')
    return futureInstant(parseOffsetInstant(value), now)
  if (!isRecord(value) || typeof value.date !== 'string' || typeof value.time !== 'string'
        || typeof value.time_zone !== 'string') {
    throw new AutomationInputError('invalid_selector', 'Local at requires date, time, and time_zone.')
  }
  const timeZone = canonicalizeTimeZone(value.time_zone)
  return futureInstant(resolveLocalInstant(parseLocalAt(value), timeZone), now)
}
/** Parse `HH:mm` local-clock time. */
function parseClockTime(value) {
  const match = LOCAL_CLOCK_TIME.exec(value)
  const groups = match?.groups
  if (groups === undefined) {
    throw new AutomationInputError('invalid_selector', 'local-clock time must be HH:mm.')
  }
  const hour = groupNumber(groups, 'hour')
  const minute = groupNumber(groups, 'minute')
  if (hour > 23 || minute > 59) {
    throw new AutomationInputError('invalid_selector', 'local-clock time must be a real HH:mm value.')
  }
  return { hour, minute }
}
/** Normalize weekday numbers: ISO 1=Monday … 7=Sunday, unique, sorted. */
function normalizeWeekdays(weekdays) {
  if (weekdays === undefined)
    return undefined
  if (weekdays.length === 0) {
    throw new AutomationInputError('invalid_selector', 'local-clock weekdays must not be empty when provided.')
  }
  const seen = new Set<number>()
  for (const day of weekdays) {
    if (!Number.isSafeInteger(day) || day < 1 || day > 7) {
      throw new AutomationInputError('invalid_selector', 'local-clock weekdays must be integers from 1 (Monday) to 7 (Sunday).')
    }
    seen.add(day)
  }
  return Object.freeze([...seen].sort((left, right) => left - right))
}
/** ISO weekday of a UTC instant interpreted in `timeZone` (1=Monday … 7=Sunday). */
function isoWeekdayInZone(epoch, timeZone) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
    .format(epoch)
  switch (weekday) {
    case 'Mon': return 1
    case 'Tue': return 2
    case 'Wed': return 3
    case 'Thu': return 4
    case 'Fri': return 5
    case 'Sat': return 6
    case 'Sun': return 7
      /* v8 ignore next 2 -- Intl weekday short names are a closed English set. */
    default: throw new AutomationInputError('invalid_time_zone', 'time_zone did not expose a usable weekday.')
  }
}
/** Next local-clock occurrence strictly after `now`. */
export function nextLocalClockInstant(selector, now) {
  const timeZone = canonicalizeTimeZone(selector.timeZone)
  const { hour, minute } = parseClockTime(selector.time)
  const weekdays = selector.weekdays === undefined ? undefined : new Set(normalizeWeekdays(selector.weekdays))
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  })
  const start = localProjection(formatter, now)
  for (let dayOffset = 0; dayOffset <= 8; dayOffset++) {
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + dayOffset))
    const parts = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute,
      second: 0,
      millisecond: 0,
    }
    let epoch
    try {
      epoch = resolveLocalInstant(parts, timeZone)
    }
    catch (error) {
      if (error instanceof AutomationInputError && error.code === 'invalid_selector')
        continue
      throw error
    }
    if (epoch <= now)
      continue
    if (weekdays !== undefined && !weekdays.has(isoWeekdayInZone(epoch, timeZone)))
      continue
    return formatUtcInstant(epoch)
  }
  throw new AutomationInputError('time_out_of_range', 'The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.')
}
/** Build a durable local-clock selector and its first future target. */
export function createLocalClockSelector(input, now) {
  const timeZone = canonicalizeTimeZone(input.time_zone)
  parseClockTime(input.time)
  const weekdays = normalizeWeekdays(input.weekdays)
  const selector = Object.freeze({
    kind: 'local-clock',
    time: input.time,
    ...weekdays === undefined ? {} : { weekdays },
    timeZone,
  })
  return { selector, scheduledAt: nextLocalClockInstant(selector, now) }
}
/** Next target after a successful fire. One-shot returns undefined. */
export function advanceScheduledAt(selector, previousScheduledAt, now) {
  switch (selector.kind) {
    case 'after':
    case 'at':
      return undefined
    case 'every': {
      const interval = selector.everySeconds * 1_000
      const target = Date.parse(previousScheduledAt)
      if (!Number.isSafeInteger(now) || !Number.isSafeInteger(target) || !Number.isSafeInteger(interval)) {
        throw new AutomationInputError('invalid_selector', 'every interval arithmetic overflowed.')
      }
      const base = now < target ? target : target + Math.floor((now - target) / interval) * interval
      const next = now < target ? target : base + interval
      if (!Number.isSafeInteger(next) || next > MAX_FOUR_DIGIT_YEAR_MS)
        return undefined
      return formatUtcInstant(next)
    }
    case 'local-clock':
      return nextLocalClockInstant(selector, now)
      /* v8 ignore next 2 -- selector is a closed union. */
    default: {
      const unreachable = selector
      throw new AutomationInputError('invalid_selector', `unknown selector ${String(unreachable)}`)
    }
  }
}
