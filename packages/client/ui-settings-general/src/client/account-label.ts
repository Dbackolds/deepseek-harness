/**
 * Display-only account name for the sidebar settings trigger. Host.describe
 * publishes the account home path, not a login; the last path segment of
 * that home is the local username on POSIX and Windows.
 */

/**
 * Last non-empty path segment of a Host account home.
 * @param home - `host.describe` home, POSIX or Windows.
 * @returns the username segment, or `undefined` when home is missing, empty, or only separators.
 */
export function accountNameFromHome(home: string | undefined): string | undefined {
  if (home === undefined) return undefined
  const trimmed = home.replace(/[/\\]+$/, '')
  if (trimmed === '') return undefined
  const parts = trimmed.split(/[/\\]/).filter(part => part.length > 0)
  const last = parts.at(-1)
  if (last === undefined || last === '.' || last === '..') return undefined
  return last
}

/**
 * Single-grapheme initial drawn in the account chip.
 * @param account - display name already resolved for the trigger.
 * @returns the first grapheme, uppercased when it has a case mapping.
 */
export function accountInitial(account: string): string {
  const initial = Array.from(account)[0]
  return initial === undefined ? '?' : initial.toLocaleUpperCase()
}
