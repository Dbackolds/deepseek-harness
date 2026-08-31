/** Client remotes apply: mount selected contributions and install connection.api. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'

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

describe('api-remotes client apply', () => {
  it('installs connection.api after mounts and restores it on dispose', async () => {
    const ctx = new Context()
    const connection = {} as { api?: { llm: { providers: () => Promise<{ result: { ok: boolean } }> } } }
    const mounted: string[] = []
    ctx.provide('connection', connection)
    ctx.provide('remote', remoteStub(async (contribution) => {
      const id = String(contribution.package ?? 'anon')
      mounted.push(id)
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
