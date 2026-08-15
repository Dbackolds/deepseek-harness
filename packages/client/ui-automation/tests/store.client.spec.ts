/** AutomationStore: list, create, enable, run-now, delete, and last-good rows. */
import { describe, expect, it } from 'vitest'
import type { RpcResponse } from '@deepseek-ai/dsh-api-remotes/client'
import { AutomationStore, messageOf, refreshIfLoaded } from '../src/client/store.ts'
import type { AutomationRuleView } from '../src/client/store.ts'

let nextRpc = 0
function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: `r-${nextRpc++}` as never, result: { ok: true, value } }
}
function fail<T>(message: string): RpcResponse<T> {
  return { rpcId: `r-${nextRpc++}` as never, result: { ok: false, error: { code: 'internal', message, details: {} } } }
}

function rule(over: Partial<AutomationRuleView> = {}): AutomationRuleView {
  return {
    id: 'rule-1' as AutomationRuleView['id'],
    name: 'morning',
    enabled: true,
    task: 'summarize inbox',
    workspaceId: 'ws-1' as AutomationRuleView['workspaceId'],
    onOverlap: 'skip',
    selector: { kind: 'after', afterSeconds: 60 },
    scheduledAt: '2026-08-15T12:01:00.000Z',
    createdAt: '2026-08-15T12:00:00.000Z',
    updatedAt: '2026-08-15T12:00:00.000Z',
    state: 'scheduled',
    nextAt: '2026-08-15T12:01:00.000Z',
    ...over,
  }
}

function api(handlers: Partial<Pick<AutomationStore extends { constructor: infer _ } ? never : never, never>> & {
  list?: () => Promise<RpcResponse<{ items: AutomationRuleView[] }>>
  create?: (payload: unknown) => Promise<RpcResponse<{ rule: AutomationRuleView }>>
  setEnabled?: (payload: unknown) => Promise<RpcResponse<{ rule: AutomationRuleView }>>
  runNow?: (payload: unknown) => Promise<RpcResponse<{ run: { id: string } }>>
  delete?: (payload: unknown) => Promise<RpcResponse<{ id: string; deleted: boolean }>>
} = {}) {
  const calls: string[] = []
  const face = {
    automation: {
      list: () => {
        calls.push('list')
        return (handlers.list ?? (() => Promise.resolve(ok({ items: [rule()] }))))()
      },
      create: (payload: unknown) => {
        calls.push('create')
        return (handlers.create ?? (() => Promise.resolve(ok({ rule: rule() }))))(payload)
      },
      setEnabled: (payload: unknown) => {
        calls.push('setEnabled')
        return (handlers.setEnabled ?? (() => Promise.resolve(ok({ rule: rule({ enabled: false, state: 'disabled' }) }))))(payload)
      },
      runNow: (payload: unknown) => {
        calls.push('runNow')
        return (handlers.runNow ?? (() => Promise.resolve(ok({ run: { id: 'run-1' } }))))(payload)
      },
      delete: (payload: unknown) => {
        calls.push('delete')
        return (handlers.delete ?? (() => Promise.resolve(ok({ id: 'rule-1', deleted: true }))))(payload)
      },
    },
  }
  return { face: face as never, calls }
}

describe('AutomationStore', () => {
  it('loads the Host list into a ready snapshot', async () => {
    const { face, calls } = api()
    const store = new AutomationStore(face)
    await store.load()
    const state = store.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.name).toBe('morning')
    expect(state.pageOpen).toBe(false)
    expect(calls).toEqual(['list'])
  })

  it('toggles the center-column page without refetching', () => {
    const { face, calls } = api()
    const store = new AutomationStore(face)
    store.setPageOpen(true)
    expect(store.store.getSnapshot().pageOpen).toBe(true)
    store.setPageOpen(false)
    expect(store.store.getSnapshot().pageOpen).toBe(false)
    expect(calls).toEqual([])
  })

  it('keeps last-good rows when a later list fails', async () => {
    let lists = 0
    const { face } = api({
      list: () => {
        lists += 1
        return lists === 1
          ? Promise.resolve(ok({ items: [rule()] }))
          : Promise.resolve(fail('down'))
      },
    })
    const store = new AutomationStore(face)
    await store.load()
    await store.load()
    const state = store.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.items).toHaveLength(1)
    expect(state.error).toBe('down')
  })

  it('surfaces a first-load failure as error with no rows', async () => {
    const { face } = api({ list: () => Promise.resolve(fail('boom')) })
    const store = new AutomationStore(face)
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({ status: 'error', error: 'boom', items: [] })
  })

  it('create, setEnabled, and remove refresh the list; runNow does not', async () => {
    const { face, calls } = api()
    const store = new AutomationStore(face)
    await store.load()
    expect(await store.create({
      task: 'ping',
      workspaceId: 'ws-1' as never,
      afterSeconds: 60,
    })).toBeUndefined()
    expect(await store.setEnabled(rule().id, false)).toBeUndefined()
    expect(await store.runNow(rule().id)).toBeUndefined()
    expect(await store.remove(rule().id)).toBeUndefined()
    expect(calls.filter(name => name === 'list')).toHaveLength(4)
    expect(calls).toContain('runNow')
  })

  it('returns the Host error message when a mutation is rejected', async () => {
    const { face } = api({
      create: () => Promise.resolve(fail('no workspace')),
      setEnabled: () => Promise.resolve(fail('cannot disable')),
      runNow: () => Promise.resolve(fail('busy')),
      delete: () => Promise.resolve(fail('missing')),
    })
    const store = new AutomationStore(face)
    expect(await store.create({
      task: 'ping',
      workspaceId: 'ws-1' as never,
      afterSeconds: 60,
    })).toBe('no workspace')
    expect(await store.setEnabled(rule().id, false)).toBe('cannot disable')
    expect(await store.runNow(rule().id)).toBe('busy')
    expect(await store.remove(rule().id)).toBe('missing')
  })

  it('refreshIfLoaded skips an unopened page', async () => {
    const { face, calls } = api()
    const store = new AutomationStore(face)
    refreshIfLoaded(store)
    expect(calls).toEqual([])
    await store.load()
    refreshIfLoaded(store)
    await Promise.resolve()
    expect(calls.filter(name => name === 'list').length).toBeGreaterThan(1)
  })

  it('messageOf stringifies unknown rejections', () => {
    expect(messageOf(new Error('x'))).toBe('x')
    expect(messageOf('plain')).toBe('plain')
  })
})
