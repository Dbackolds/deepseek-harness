import { afterEach, describe, expect, it, vi } from 'vitest'
import { readDesktopBridge, setDesktopCompletedUnread } from '../src/client/desktop-attention.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readDesktopBridge', () => {
  it('returns the preload face when present and undefined otherwise', () => {
    expect(readDesktopBridge({})).toBeUndefined()
    expect(readDesktopBridge(undefined)).toBeUndefined()
    const setCompletedUnread = (_count: number): void => {}
    expect(readDesktopBridge({ dshDesktop: { setCompletedUnread } })?.setCompletedUnread)
      .toBe(setCompletedUnread)
  })
})

describe('setDesktopCompletedUnread', () => {
  it('is a no-op without a desktop preload', () => {
    expect(() => { setDesktopCompletedUnread(1) }).not.toThrow()
  })

  it('publishes the count when the desktop Host is present', () => {
    const setCompletedUnread = vi.fn()
    vi.stubGlobal('dshDesktop', { setCompletedUnread })
    setDesktopCompletedUnread(3)
    expect(setCompletedUnread).toHaveBeenCalledWith(3)
  })

  it('swallows a throwing Host call', () => {
    vi.stubGlobal('dshDesktop', {
      setCompletedUnread: () => { throw new Error('dock unavailable') },
    })
    expect(() => { setDesktopCompletedUnread(1) }).not.toThrow()
  })

  it('is a no-op when the preload omits setCompletedUnread', () => {
    vi.stubGlobal('dshDesktop', { minimize: () => {} })
    expect(() => { setDesktopCompletedUnread(1) }).not.toThrow()
  })
})
