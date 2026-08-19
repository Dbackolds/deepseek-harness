/**
 * Unread Completed count for the sidebar brand badge. The reminder bit lives
 * on each session-list row; this module only counts and formats it.
 */

/**
 * Count listed Sessions that still carry the Completed reminder.
 * @param byId - current session-list rows.
 * @returns the unread Completed count.
 */
export function unreadCompletedCount(
  byId: Record<string, { completed?: boolean }>,
): number {
  let count = 0
  for (const row of Object.values(byId)) {
    if (row.completed === true) count += 1
  }
  return count
}

/**
 * Compact count for the brand badge: 1–99 stay digits; 100+ collapses to 99+.
 * @param count - unread Completed count.
 * @returns the badge label.
 */
export function unreadCompletedBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}
