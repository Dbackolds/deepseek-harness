import { describe, expect, it } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { HostLifetimeSettings } from '../src/host-lifetime.ts'
import { formatHostStartTime, HostStartMetaPolicy } from '../src/client/host-start-meta.ts'

function scope(initial: SettingsScopeSnapshot<HostLifetimeSettings>) {
  let current = initial
  const listeners = new Set<() => void>()
  const host: SettingsScope<HostLifetimeSettings> = {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    mutate: async () => undefined,
    set: async () => undefined,
    unset: async () => undefined,
  }
  return {
    host,
    emit(next: SettingsScopeSnapshot<HostLifetimeSettings>) {
      current = next
      for (const listener of listeners) listener()
    },
  }
}

describe('HostStartMetaPolicy', () => {
  it('hides facts when no Host scope is bound', () => {
    const policy = new HostStartMetaPolicy()
    expect(policy.store.getSnapshot()).toEqual({ status: 'unavailable', startCount: 0 })
  })

  it('stays loading until the Host section is accepted, then hides an unavailable section', () => {
    const { host, emit } = scope({
      status: 'loading',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: true,
      mode: 'host',
    })
    const policy = new HostStartMetaPolicy(host)
    expect(policy.store.getSnapshot()).toEqual({ status: 'loading', startCount: 0 })
    emit({
      status: 'unavailable',
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
      mode: 'memory',
    })
    expect(policy.store.getSnapshot()).toEqual({ status: 'unavailable', startCount: 0 })
  })

  it('adopts a ready Host-lifetime section and ignores an empty startedAt', () => {
    const { host, emit } = scope({
      status: 'ready',
      value: { startCount: 4, startedAt: '' },
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host',
    })
    const policy = new HostStartMetaPolicy(host)
    expect(policy.store.getSnapshot()).toEqual({ status: 'ready', startCount: 4 })
    emit({
      status: 'ready',
      value: { startCount: 5, startedAt: '2026-08-29T00:17:56.000Z' },
      base: undefined,
      user: undefined,
      revision: 2,
      writable: true,
      mode: 'host',
    })
    expect(policy.store.getSnapshot()).toEqual({
      status: 'ready',
      startCount: 5,
      startedAt: '2026-08-29T00:17:56.000Z',
    })
  })
})

describe('formatHostStartTime', () => {
  it('keeps an unparseable value and formats a real instant', () => {
    expect(formatHostStartTime('not-a-date')).toBe('not-a-date')
    const formatted = formatHostStartTime('2026-08-29T00:17:56.000Z')
    expect(formatted.length).toBeGreaterThan(0)
    expect(formatted).not.toBe('not-a-date')
  })
})
