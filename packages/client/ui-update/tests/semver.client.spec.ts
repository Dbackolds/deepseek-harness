import { describe, expect, it } from 'vitest'
import { compareSemver, isNewer, isPrereleaseVersion, parseSemver } from '../src/semver.ts'

describe('parseSemver', () => {
  it('accepts a core triple, a leading v, and a build suffix', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    expect(parseSemver('V1.2.3+build.1')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    expect(parseSemver('1.2.3-rc.2')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['rc', 2] })
  })

  it('rejects incomplete, padded, and empty identifiers', () => {
    expect(parseSemver('1.2')).toBeUndefined()
    expect(parseSemver('01.2.3')).toBeUndefined()
    expect(parseSemver('1.2.3-')).toBeUndefined()
    expect(parseSemver('1.2.3-rc.')).toBeUndefined()
    expect(parseSemver('')).toBeUndefined()
  })
})

describe('compareSemver / isNewer', () => {
  it('orders numeric triples and treats a prerelease as older than the release', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toBeLessThan(0)
    expect(compareSemver('1.3.0', '1.2.9')).toBeGreaterThan(0)
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('1.2.3-rc.1', '1.2.3')).toBeLessThan(0)
    expect(compareSemver('1.2.3', '1.2.3-rc.1')).toBeGreaterThan(0)
    expect(isNewer('1.2.4', '1.2.3')).toBe(true)
    expect(isNewer('1.2.3', '1.2.3')).toBe(false)
    expect(isNewer('1.2.3-rc.2', '1.2.3-rc.1')).toBe(true)
  })

  it('compares prerelease identifiers numerically, then as strings', () => {
    expect(compareSemver('1.0.0-alpha.2', '1.0.0-alpha.11')).toBeLessThan(0)
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBeLessThan(0)
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-beta')).toBeLessThan(0)
    expect(compareSemver('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0)
    expect(compareSemver('not-a-version', '1.0.0')).toBeUndefined()
    expect(isNewer('nope', '1.0.0')).toBe(false)
    expect(isPrereleaseVersion('1.0.0-rc.1')).toBe(true)
    expect(isPrereleaseVersion('1.0.0')).toBe(false)
    expect(isPrereleaseVersion('nope')).toBe(false)
  })
})
