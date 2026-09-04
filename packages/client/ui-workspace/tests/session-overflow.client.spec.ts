import { describe, expect, it } from 'vitest'
import {
  nextSessionOverflowLimit, ordinarySessionCount, resolvedSessionOverflowLimit,
  sessionOverflowBaseLimit, sessionOverflowCanCollapse, sessionOverflowRevealCount,
  sessionOverflowStep,
} from '../src/client/session-overflow.ts'

describe('session overflow math', () => {
  it('treats expand-all as an unfolded projection', () => {
    expect(sessionOverflowBaseLimit('all')).toBeNull()
    expect(sessionOverflowStep('all')).toBeNull()
    expect(resolvedSessionOverflowLimit(20, 'all')).toBeNull()
  })

  it('advances by the configured step without overshooting the ordinary count', () => {
    expect(resolvedSessionOverflowLimit(undefined, 5)).toBe(5)
    expect(resolvedSessionOverflowLimit(5, 5)).toBe(5)
    expect(nextSessionOverflowLimit(5, 5, 12)).toBe(10)
    expect(nextSessionOverflowLimit(10, 5, 12)).toBe(12)
    expect(sessionOverflowRevealCount(5, 5, 12)).toBe(5)
    expect(sessionOverflowRevealCount(10, 5, 12)).toBe(2)
    expect(sessionOverflowCanCollapse(undefined, 5)).toBe(false)
    expect(sessionOverflowCanCollapse(5, 5)).toBe(false)
    expect(sessionOverflowCanCollapse(10, 5)).toBe(true)
    expect(sessionOverflowCanCollapse(20, 'all')).toBe(false)
  })

  it('ignores blank New Session rows when counting the ordinary quota', () => {
    expect(ordinarySessionCount([
      { blank: true },
      { blank: false },
      {},
      { blank: true },
    ])).toBe(2)
  })
})
