/**
 * SemVer 2.0.0 comparison used to decide whether a GitHub release is newer.
 *
 * Build metadata is ignored. A release with a prerelease identifier is older
 * than the same numeric triple without one. Invalid input does not compare.
 */

/** Parsed numeric triple plus prerelease identifiers. */
export interface ParsedSemver {
  major: number
  minor: number
  patch: number
  prerelease: readonly (string | number)[]
}

/**
 * Parse a SemVer core (`major.minor.patch` plus optional `-prerelease`).
 * A leading `v`/`V` and a `+build` suffix are ignored.
 *
 * @param input - version string, with or without a leading `v`.
 * @returns the parsed triple, or `undefined` when the input is not SemVer.
 */
export function parseSemver(input: string): ParsedSemver | undefined {
  const stripped = input.startsWith('v') || input.startsWith('V') ? input.slice(1) : input
  const plus = stripped.indexOf('+')
  const core = plus === -1 ? stripped : stripped.slice(0, plus)
  const dash = core.indexOf('-')
  const numeric = dash === -1 ? core : core.slice(0, dash)
  const pre = dash === -1 ? '' : core.slice(dash + 1)
  const parts = numeric.split('.')
  if (parts.length !== 3) return undefined
  const [majorText, minorText, patchText] = parts
  if (majorText === undefined || minorText === undefined || patchText === undefined) return undefined
  const major = parseDec(majorText)
  const minor = parseDec(minorText)
  const patch = parseDec(patchText)
  if (major === undefined || minor === undefined || patch === undefined) return undefined
  // A trailing dash with no identifier (`1.2.3-`) is not SemVer.
  if (dash !== -1 && pre === '') return undefined
  if (pre === '') return { major, minor, patch, prerelease: [] }
  const ids = pre.split('.').map(parsePreId)
  if (ids.some(id => id === undefined)) return undefined
  return { major, minor, patch, prerelease: ids as (string | number)[] }
}

function parseDec(s: string): number | undefined {
  if (s === '' || !/^(0|[1-9]\d*)$/.test(s)) return undefined
  return Number(s)
}

function parsePreId(s: string): string | number | undefined {
  if (s === '') return undefined
  if (/^(0|[1-9]\d*)$/.test(s)) return Number(s)
  if (/^[0-9A-Za-z-]+$/.test(s)) return s
  return undefined
}

/**
 * Compare two SemVer strings.
 *
 * @param a - left version.
 * @param b - right version.
 * @returns negative when `a < b`, zero when equal, positive when `a > b`,
 *   or `undefined` when either side is not SemVer.
 */
export function compareSemver(a: string, b: string): number | undefined {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (left === undefined || right === undefined) return undefined
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  if (left.patch !== right.patch) return left.patch - right.patch
  return comparePrerelease(left.prerelease, right.prerelease)
}

function comparePrerelease(
  a: readonly (string | number)[],
  b: readonly (string | number)[],
): number {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const left = a[i]
    const right = b[i]
    if (left === undefined || right === undefined) break
    if (left === right) continue
    const leftNum = typeof left === 'number'
    const rightNum = typeof right === 'number'
    if (leftNum && rightNum) return left - right
    if (leftNum) return -1
    if (rightNum) return 1
    return left < right ? -1 : 1
  }
  return a.length - b.length
}

/**
 * Whether `candidate` is a strictly newer SemVer than `current`.
 *
 * @param candidate - proposed version.
 * @param current - installed version.
 * @returns `true` only when both parse and `candidate > current`.
 */
export function isNewer(candidate: string, current: string): boolean {
  const cmp = compareSemver(candidate, current)
  return cmp !== undefined && cmp > 0
}

/**
 * Whether a version string carries a prerelease identifier.
 *
 * @param version - version string.
 * @returns `true` when the parsed prerelease list is non-empty.
 */
export function isPrereleaseVersion(version: string): boolean {
  const parsed = parseSemver(version)
  return parsed !== undefined && parsed.prerelease.length > 0
}
