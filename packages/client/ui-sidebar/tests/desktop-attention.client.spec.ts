import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyDesktopCompletedAttention, readDesktopBridge } from '../src/client/desktop-attention.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readDesktopBridge', () => {
  it('returns the preload face when present and undefined otherwise', () => {
    expect(readDesktopBridge({})).toBeUndefined()
    expect(readDesktopBridge(undefined)).toBeUndefined()
    const notifyCompleted = (): void => {}
    expect(readDesktopBridge({ dshDesktop: { notifyCompleted } })?.notifyCompleted).toBe(notifyCompleted)
  })
})

describe('notifyDesktopCompletedAttention', () => {
  it('is a no-op without a desktop preload', () => {
    expect(() => { notifyDesktopCompletedAttention() }).not.toThrow()
  })

  it('calls notifyCompleted when the desktop Host is present', () => {
    const notifyCompleted = vi.fn()
    vi.stubGlobal('dshDesktop', { notifyCompleted })
    notifyDesktopCompletedAttention()
    expect(notifyCompleted).toHaveBeenCalledOnce()
  })

  it('swallows a throwing Host call so the in-page badge still stands', () => {
    vi.stubGlobal('dshDesktop', {
      notifyCompleted: () => { throw new Error('dock unavailable') },
    })
    expect(() => { notifyDesktopCompletedAttention() }).not.toThrow()
  })

  it('is a no-op when the preload omits notifyCompleted', () => {
    vi.stubGlobal('dshDesktop', { minimize: () => {} })
    expect(() => { notifyDesktopCompletedAttention() }).not.toThrow()
  })
})
