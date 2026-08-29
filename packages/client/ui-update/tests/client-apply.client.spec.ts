// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject, name, NS } from '../src/client/index.ts'
import { en, zh } from '../src/client/locales.ts'
import type { ProductCheckResult } from '../src/update-settings.ts'
import { PRODUCT_UPDATE_RPC_CHANNEL } from '../src/rpc-channel.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeScope(lastResult?: ProductCheckResult) {
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => ({
      status: 'ready' as const,
      value: lastResult === undefined ? {} : { lastResult },
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host' as const,
    }),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: async () => {},
    unset: async () => {},
    listeners,
  }
}

describe('product-update client apply', () => {
  it('registers dictionaries, slots, and check/dismiss RPC', async () => {
    const ctx = new Context()
    const localeDisposer = vi.fn()
    const locale = { register: vi.fn(() => localeDisposer) }
    const scope = fakeScope({
      available: true,
      currentVersion: '1.2.3',
      latest: { tag: 'dsh-v1.2.4', version: '1.2.4', url: 'https://example.test/1.2.4', notes: '' },
      checkedAt: 1,
      channel: 'dsh',
    })
    const settingsScope = { bind: vi.fn(() => scope) }
    const registered: Array<{ name: string; id: string }> = []
    const slots = {
      inject: vi.fn((_name: string, factory: () => void) => { factory() }),
      register: vi.fn((spec: {
        name: string
        id: string
        inject?: () => { checkNow: () => void; dismiss: () => void; openRelease: () => void }
      }) => {
        registered.push({ name: spec.name, id: spec.id })
        return () => {}
      }),
    }
    const calls: Array<{ channel: string; endpoint: string; payload: unknown }> = []
    const rpc = {
      call: vi.fn(async (channel: string, endpoint: string, payload: unknown) => {
        calls.push({ channel, endpoint, payload })
        if (endpoint === 'check') {
          return {
            ok: true,
            value: {
              available: true,
              currentVersion: '1.2.3',
              latest: { tag: 'dsh-v1.2.4', version: '1.2.4', url: 'https://example.test/1.2.4', notes: '' },
              checkedAt: 2,
              channel: 'dsh',
            },
          }
        }
        return { ok: true, value: { ok: true } }
      }),
    }
    ctx.provide('locale', locale as never)
    ctx.provide('settingsScope', settingsScope as never)
    ctx.provide('slots', slots as never)
    ctx.provide('connection', { rpc } as never)
    const open = vi.fn()
    vi.stubGlobal('open', open)
    apply(ctx)
    expect(locale.register).toHaveBeenCalledWith(NS, { zh, en })
    expect(registered).toEqual([
      { name: 'settings.general.item', id: 'product-update' },
      { name: 'shell.overlay', id: 'product-update' },
    ])
    expect(name).toBe('client-ui-update')
    expect(inject).toEqual(['slots', 'locale', 'settingsScope', 'connection'])
    await vi.waitFor(() => { expect(calls.some(row => row.endpoint === 'check')).toBe(true) })
    const rowSpec = slots.register.mock.calls[0]![0]
    rowSpec.inject!().checkNow()
    await vi.waitFor(() => { expect(calls.filter(row => row.endpoint === 'check').length).toBeGreaterThan(1) })
    rowSpec.inject!().dismiss()
    await vi.waitFor(() => { expect(calls.some(row => row.channel === PRODUCT_UPDATE_RPC_CHANNEL && row.endpoint === 'dismiss')).toBe(true) })
    rowSpec.inject!().openRelease()
    expect(open).toHaveBeenCalledWith('https://example.test/1.2.4', '_blank', 'noopener,noreferrer')
  })

  it('marks the status error when check RPC fails and no-ops dismiss without a tag', async () => {
    const ctx = new Context()
    const locale = { register: vi.fn(() => () => {}) }
    const settingsScope = { bind: vi.fn(() => fakeScope()) }
    let injected: { checkNow: () => void; dismiss: () => void; openRelease: () => void } | undefined
    const slots = {
      inject: vi.fn((_name: string, factory: () => void) => { factory() }),
      register: vi.fn((spec: {
        inject?: () => { checkNow: () => void; dismiss: () => void; openRelease: () => void }
      }) => {
        injected = spec.inject?.()
        return () => {}
      }),
    }
    const rpc = {
      call: vi.fn(async (_channel: string, _endpoint: string, _payload?: unknown) => (
        { ok: false, error: { code: 'internal', message: 'offline', details: {} } }
      )),
    }
    ctx.provide('locale', locale as never)
    ctx.provide('settingsScope', settingsScope as never)
    ctx.provide('slots', slots as never)
    ctx.provide('connection', { rpc } as never)
    apply(ctx)
    injected!.dismiss()
    injected!.openRelease()
    await vi.waitFor(() => { expect(rpc.call).toHaveBeenCalled() })
    expect(rpc.call.mock.calls.some(call => call[1] === 'dismiss')).toBe(false)
  })
})
