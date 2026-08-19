import { describe, expect, it } from 'vitest'
import { unreadCompletedBadgeLabel, unreadCompletedCount } from '../src/client/completed-badge.ts'

describe('unreadCompletedCount', () => {
  it('counts only rows whose Completed reminder is still armed', () => {
    expect(unreadCompletedCount({})).toBe(0)
    expect(unreadCompletedCount({
      a: { completed: true },
      b: { completed: false },
      c: {},
      d: { completed: true },
    })).toBe(2)
  })
})

describe('unreadCompletedBadgeLabel', () => {
  it('keeps 1–99 as digits and collapses 100+ to 99+', () => {
    expect(unreadCompletedBadgeLabel(1)).toBe('1')
    expect(unreadCompletedBadgeLabel(99)).toBe('99')
    expect(unreadCompletedBadgeLabel(100)).toBe('99+')
  })
})
