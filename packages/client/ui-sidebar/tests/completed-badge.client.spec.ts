import { describe, expect, it } from 'vitest'
import { unreadCompletedCount } from '../src/client/completed-badge.ts'

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
