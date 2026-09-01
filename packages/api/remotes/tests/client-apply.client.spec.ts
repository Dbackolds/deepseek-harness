/** Client remotes apply: mount selected contributions and install connection.api. */
import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

function remoteStub(mount: (contribution: { package?: string }) => Promise<() => Promise<void>>) {
  return {
    $mount: mount,
    llm: {
      listProviders: async () => ({ ok: true, value: [] }),
      listConfigurableProviders: async () => ({ ok: true, value: [] }),
    },
    settings: {
      describe: async () => ({ ok: true, value: { writable: true, hasDocument: false, namespaces: [] } }),
      update: async () => ({ ok: false, error: { code: 'internal', message: 'unused', details: {} } }),
    },
  }
}

class TracedRemote extends Service {
  constructor(
    ctx: Context,
    readonly mount: (contribution: { package?: string }) => Promise<() => Promise<void>>,
  ) {
    super(ctx, 'remote')
  }

  $mount(contribution: { package?: string }): Promise<() => Promise<void>> {
    return this.mount(contribution)
  }
}

class TracedLlm extends Service {
  constructor(ctx: Context) {
    super(ctx, 'remote.llm')
  }

  listProviders = async () => ({ ok: true, value: [] })
  listConfigurableProviders = async () => ({ ok: true, value: [] })
}

class TracedSettings extends Service {
  constructor(ctx: Context) {
    super(ctx, 'remote.settings')
  }

  describe = async () => ({ ok: true, value: { writable: true, hasDocument: false, namespaces: [] } })
  update = async () => ({ ok: false, error: { code: 'internal', message: 'unused', details: {} } })
}

describe('api-remotes client apply', () => {
  it('installs connection.api from a fiber that only injects remote', async () => {
    const ctx = new Context()
    const connection = {} as { api?: { llm: { providers: () => Promise<{ result: { ok: boolean } }> } } }
    ctx.provide('connection', connection)
    new TracedRemote(ctx, async () => {
      // Mirror gateway createNamespace: each Remote lives on a cousin fiber,
      // not on this assembly's ancestor chain.
      await ctx.plugin((scope) => {
        if (scope.get('remote.llm') === undefined) new TracedLlm(scope)
        if (scope.get('remote.settings') === undefined) new TracedSettings(scope)
      })
      return async () => {}
    })
    const fiber = ctx.plugin({ inject, apply })
    await fiber
    expect(connection.api?.llm.providers).toEqual(expect.any(Function))
    expect((await connection.api!.llm.providers()).result.ok).toBe(true)
    await fiber.dispose()
    expect(connection.api).toBeUndefined()
  })

  it('installs connection.api after mounts and restores it on dispose', async () => {
    const ctx = new Context()
    const connection = {} as { api?: { llm: { providers: () => Promise<{ result: { ok: boolean } }> } } }
    const mounted: string[] = []
    ctx.provide('connection', connection)
    ctx.provide('remote', remoteStub(async (contribution) => {
      const id = String(contribution.package ?? 'anon')
      mounted.push(id)
      await ctx.plugin((scope) => {
        if (scope.get('remote.llm') === undefined) new TracedLlm(scope)
        if (scope.get('remote.settings') === undefined) new TracedSettings(scope)
      })
      return async () => { mounted.push('dispose:' + id) }
    }))
    const dispose = await apply(ctx as never)
    expect(mounted.length).toBeGreaterThan(0)
    expect(connection.api?.llm.providers).toEqual(expect.any(Function))
    expect((await connection.api!.llm.providers()).result.ok).toBe(true)
    await dispose()
    expect(connection.api).toBeUndefined()
    expect(mounted.some(entry => entry.startsWith('dispose:'))).toBe(true)
  })

  it('skips the compatibility face when no Connection handle is present', async () => {
    const ctx = new Context()
    ctx.provide('remote', remoteStub(async () => async () => {}))
    const dispose = await apply(ctx as never)
    expect(ctx.get('connection')).toBeUndefined()
    await dispose()
  })

  it('unwinds earlier mounts when a later contribution fails', async () => {
    const ctx = new Context()
    let calls = 0
    const disposed: number[] = []
    ctx.provide('remote', remoteStub(async () => {
      calls += 1
      const index = calls
      if (index === 3) throw new Error('mount failed')
      return async () => { disposed.push(index) }
    }))
    await expect(apply(ctx as never)).rejects.toThrow('mount failed')
    expect(disposed).toEqual([2, 1])
  })
})
