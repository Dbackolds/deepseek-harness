/** Live keep-awake preference: process-local default and Host adoption. */
import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { AutomationKeepAwakePolicy } from '../src/client/keep-awake-policy.ts'
import { DEFAULT_KEEP_AWAKE, type AutomationSettings } from '../src/automation-settings.ts'

function fakeScope(initial?: AutomationSettings): SettingsScope<AutomationSettings> & {
  publish: (value: AutomationSettings) => void
  setMock: ReturnType<typeof vi.fn>
} {
  const setMock = vi.fn(async () => undefined)
  let snapshot: SettingsScopeSnapshot<AutomationSettings> = {
    status: initial === undefined ? 'loading' : 'ready',
    value: initial,
    base: undefined,
    user: undefined,
    revision: initial === undefined ? undefined : 0,
    writable: true,
    mode: 'host',
  }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: setMock,
    unset: vi.fn(async () => undefined),
    publish(value) {
      snapshot = { ...snapshot, status: 'ready', value, revision: (snapshot.revision ?? -1) + 1 }
      for (const listener of listeners) listener()
    },
    setMock,
  }
}

describe('AutomationKeepAwakePolicy', () => {
  it('stays off without a host and publishes before writing', () => {
    const policy = new AutomationKeepAwakePolicy()
    expect(policy.keepAwake.getSnapshot()).toBe(DEFAULT_KEEP_AWAKE)
    policy.setKeepAwake(true)
    expect(policy.keepAwake.getSnapshot()).toBe(true)
    policy.setKeepAwake(true)
    expect(policy.keepAwake.getSnapshot()).toBe(true)
  })

  it('adopts a later host section and writes through set', () => {
    const host = fakeScope()
    const policy = new AutomationKeepAwakePolicy(host)
    expect(policy.keepAwake.getSnapshot()).toBe(false)
    host.publish({ keepAwake: true })
    expect(policy.keepAwake.getSnapshot()).toBe(true)
    policy.setKeepAwake(false)
    expect(host.setMock).toHaveBeenCalledWith('keepAwake', false)
  })

  it('keeps a user choice while a stale Host snapshot still carries the previous value', async () => {
    const host = fakeScope({ keepAwake: false })
    const policy = new AutomationKeepAwakePolicy(host)
    let settle!: () => void
    host.setMock.mockImplementation(() => new Promise<void>((resolve) => { settle = resolve }))
    policy.setKeepAwake(true)
    expect(policy.keepAwake.getSnapshot()).toBe(true)
    host.publish({ keepAwake: false })
    expect(policy.keepAwake.getSnapshot()).toBe(true)
    settle()
    await Promise.resolve()
    expect(policy.keepAwake.getSnapshot()).toBe(true)
  })

  it('adopts the Host value after a failed write settles', async () => {
    const host = fakeScope({ keepAwake: false })
    const policy = new AutomationKeepAwakePolicy(host)
    host.setMock.mockImplementation(() => Promise.reject(new Error('offline')))
    policy.setKeepAwake(true)
    expect(policy.keepAwake.getSnapshot()).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(policy.keepAwake.getSnapshot()).toBe(false)
  })
})
