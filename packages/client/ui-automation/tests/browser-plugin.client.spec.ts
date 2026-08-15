/**
 * ui-automation plugin halves: the browser entry's dictionary and sidebar-slot
 * registrations against the real SlotRegistry (with fiber teardown proving
 * removal — HMR safety), the inert node entry, and the invariant companion's
 * ownership reservation.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as AutomationInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'sidebar.automation': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  const automation = {
    list: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: { items: [] } } }),
    create: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: { rule: {} } } }),
    setEnabled: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: { rule: {} } } }),
    runNow: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: { run: {} } } }),
    delete: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: { id: 'rule-1', deleted: true } } }),
  }
  ctx.provide('connection', { api: { automation, settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('ui-automation browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
  })

  it('registers the sidebar occupant, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(ctx.slots.entries('sidebar.automation')).toHaveLength(1)
    const injected = (ctx.slots.entries('sidebar.automation')[0]!.inject as () => {
      load: () => Promise<void>
      create: (input: { task: string; workspaceId: never; afterSeconds: number }) => Promise<string | undefined>
      setEnabled: (id: never, enabled: boolean) => Promise<string | undefined>
      runNow: (id: never) => Promise<string | undefined>
      remove: (id: never) => Promise<string | undefined>
    })()
    await injected.load()
    await injected.create({ task: 'ping', workspaceId: 'ws-1' as never, afterSeconds: 60 })
    await injected.setEnabled('rule-1' as never, false)
    await injected.runNow('rule-1' as never)
    await injected.remove('rule-1' as never)
    ctx.emit('connection/reset')
    await fiber.dispose()
    expect(ctx.slots.entries('sidebar.automation')).toHaveLength(0)
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('trigger')).toBe(zh.trigger)
    ctx.locale.setLocale('en')
    expect(translate('trigger')).toBe(en.trigger)

    await fiber.dispose()
    expect(translate('trigger')).not.toBe(en.trigger)
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-automation node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-automation invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(AutomationInvariant)
    await fiber.await()
    expect(AutomationInvariant.name).toBe('client-ui-automation-invariant')
    expect(AutomationInvariant.inject).toEqual(['invariants'])
    expect(() => { (ctx.emit as (event: string) => void)('slots/changed') }).not.toThrow()
    await fiber.dispose()
  })
})
