/**
 * ui-git-branch plugin halves: the browser entry dictionaries and hero-slot
 * registration against the real SlotRegistry (with fiber teardown proving
 * removal — HMR safety), the inert node entry, and the invariant companion.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as GitInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'

function heroOccupied(ctx: Context): boolean {
  return ctx.slots.entries('conversation.hero.branch').length > 0
}

async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.hero.branch': { kind: 'single', scope: 'session-maybe' },
    },
  } as never, () => null)
  const listeners = new Set<() => void>()
  ctx.provide('sessions', {
    list: {
      getSnapshot: () => ({ current: undefined }),
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        listener()
        return () => { listeners.delete(listener) }
      },
    },
  })
  ctx.provide('conversation', {})
  ctx.provide('connection', {
    api: {
      git: {
        describe: () => Promise.resolve({ rpcId: 'r', result: { ok: false, error: { code: 'git-not-a-repository', message: 'no', details: {} } } }),
        checkout: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: {} } }),
        createBranch: () => Promise.resolve({ rpcId: 'r', result: { ok: true, value: {} } }),
      },
    },
    isLoopback: false,
  } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

describe('ui-git-branch browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'sessions'])
  })

  it('registers the hero chip, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(heroOccupied(ctx)).toBe(true)
    const injected = ctx.slots.entries('conversation.hero.branch')[0]!.inject as () => {
      load: () => Promise<void>
      checkout: (branch: string) => Promise<void>
      createBranch: (branch: string) => Promise<void>
    }
    await injected().load()
    await injected().checkout('main')
    await injected().createBranch('topic')
    await fiber.dispose()
    expect(heroOccupied(ctx)).toBe(false)
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('seat.hint')).toBe(zh['seat.hint'])
    ctx.locale.setLocale('en')
    expect(translate('seat.hint')).toBe(en['seat.hint'])
    await fiber.dispose()
    expect(translate('seat.hint')).not.toBe(en['seat.hint'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-git-branch node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-git-branch invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(GitInvariant)
    await fiber.await()
    expect(GitInvariant.name).toBe('client-ui-git-branch-invariant')
    expect(GitInvariant.inject).toEqual(['invariants'])
    expect(() => { (ctx.emit as (event: string) => void)('slots/changed') }).not.toThrow()
    await fiber.dispose()
  })
})
