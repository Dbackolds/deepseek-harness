// Always-visible local clock for a chat message row.

import { formatMessageClock } from './message-chrome.ts'
import { useCalendarDay } from './use-calendar-day.ts'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './MessageClock.module.css'

/**
 * Compact date-aware clock aligned to the trailing edge of a message row.
 * @param props - Event time and the owning view's locale seat.
 * @returns The clock label, or null when the message has no event time.
 */
export function MessageClock({
  time,
  t,
}: {
  /** Unix epoch ms from the source session event; omitted for transients. */
  time?: number | undefined
  t: ChatViewSlotProps['t']
}) {
  const day = useCalendarDay()
  if (time === undefined) return null
  return <time className={css.clock} dateTime={new Date(time).toISOString()}>{formatMessageClock(time, t, day)}</time>
}
