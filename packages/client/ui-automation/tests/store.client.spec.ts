/** AutomationStore: list, create, enable, run-now, delete, and last-good rows. */
import { describe, expect, it } from 'vitest'
import type { RpcResponse, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
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
  runNow?: (payload: unknown) => Promise<RpcResponse<{
    run: { id: string; outcome?: string; sessionId?: string; errorCode?: string }
  }>>
  listRuns?: (payload: unknown) => Promise<RpcResponse<{ items: unknown[] }>>
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
        return (handlers.runNow ?? (() => Promise.resolve(ok({
          run: { id: 'run-1', outcome: 'started', sessionId: 'session-1' },
        }))))(payload)
      },
      listRuns: (payload: unknown) => {
        calls.push('listRuns')
        return (handlers.listRuns ?? (() => Promise.resolve(ok({
          items: [{ id: 'run-1', sessionId: 'session-1', outcome: 'started' }],
        }))))(payload)
      },
      delete: (payload: unknown) => {
        calls.push('delete')
        return (handlers.delete ?? (() => Promise.resolve(ok({ id: 'rule-1', deleted: true }))))(payload)
      },
    },
  }
  return { face: face as never, calls }
}

function sessionsFace(listed: readonly string[] = ['session-1']) {
  const opened: SessionId[] = []
  const byId = Object.fromEntries(listed.map(id => [id, { id }]))
  const list = createSnapshotStore({
    ids: listed as SessionId[],
    byId,
    current: undefined,
    phase: 'ready',
  })
  return {
    face: {
      list,
      open: (id: SessionId) => { opened.push(id) },
    },
    opened,
    list,
  }
}

describe('AutomationStore', () => {
  it('loads the Host list into a ready snapshot', async () => {
    const { face, calls } = api()
    const store = new AutomationStore(face, sessionsFace().face)
    await store.load()
    const state = store.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.items).toHaveLength(1)
    expect(state.items[0]?.rule.name).toBe('morning')
    expect(state.items[0]?.runCount).toBe(1)
    expect(state.items[0]?.lastSessionId).toBe('session-1')
    expect(state.pageOpen).toBe(false)
    expect(calls).toEqual(['list', 'listRuns'])
  })

  it('toggles the center-column page without refetching', () => {
    const { face, calls } = api()
    const store = new AutomationStore(face, sessionsFace().face)
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
    const store = new AutomationStore(face, sessionsFace().face)
    await store.load()
    await store.load()
    const state = store.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.items).toHaveLength(1)
    expect(state.error).toBe('down')
  })

  it('surfaces a first-load failure as error with no rows', async () => {
    const { face } = api({ list: () => Promise.resolve(fail('boom')) })
    const store = new AutomationStore(face, sessionsFace().face)
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({ status: 'error', error: 'boom', items: [] })
  })

  it('create, setEnabled, and remove refresh the list; a started runNow opens the Session', async () => {
    const { face, calls } = api()
    const sessions = sessionsFace()
    const store = new AutomationStore(face, sessions.face)
    await store.load()
    store.setPageOpen(true)
    expect(await store.create({
      task: 'ping',
      workspaceId: 'ws-1' as never,
      afterSeconds: 60,
    })).toBeUndefined()
    expect(await store.setEnabled(rule().id, false)).toBeUndefined()
    expect(await store.runNow(rule().id)).toBeUndefined()
    expect(store.store.getSnapshot().pageOpen).toBe(false)
    expect(sessions.opened).toEqual(['session-1'])
    expect(await store.remove(rule().id)).toBeUndefined()
    expect(calls.filter(name => name === 'list')).toHaveLength(5)
    expect(calls).toContain('runNow')
  })

  it('waits for the started Session to land in the list before opening it', async () => {
    const { face } = api()
    const sessions = sessionsFace([])
    const store = new AutomationStore(face, sessions.face)
    const pending = store.runNow(rule().id)
    await Promise.resolve()
    expect(sessions.opened).toEqual([])
    expect(store.store.getSnapshot().pageOpen).toBe(false)
    sessions.list.update((draft) => {
      draft.ids = ['session-1' as SessionId]
      draft.byId = { ['session-1' as SessionId]: { id: 'session-1' as SessionId } }
    })
    expect(await pending).toBeUndefined()
    expect(sessions.opened).toEqual(['session-1'])
  })

  it('opens the previous Session when a skip finds a last started run', async () => {
    const { face } = api({
      runNow: () => Promise.resolve(ok({ run: { id: 'run-2', outcome: 'skipped_busy' } })),
    })
    const sessions = sessionsFace()
    const store = new AutomationStore(face, sessions.face)
    await store.load()
    store.setPageOpen(true)
    expect(await store.runNow(rule().id)).toBe('skipped_busy')
    expect(store.store.getSnapshot().pageOpen).toBe(false)
    expect(sessions.opened).toEqual(['session-1'])
  })

  it('keeps the page open when a skip has no last Session', async () => {
    const { face } = api({
      listRuns: () => Promise.resolve(ok({ items: [] })),
      runNow: () => Promise.resolve(ok({ run: { id: 'run-1', outcome: 'skipped_busy' } })),
    })
    const sessions = sessionsFace()
    const store = new AutomationStore(face, sessions.face)
    store.setPageOpen(true)
    expect(await store.runNow(rule().id)).toBe('skipped_busy')
    expect(store.store.getSnapshot().pageOpen).toBe(true)
    expect(sessions.opened).toEqual([])
  })

  it('maps a max-concurrent skip and a failed fire without opening a Session', async () => {
    const maxed = api({
      runNow: () => Promise.resolve(ok({
        run: { id: 'run-1', outcome: 'skipped_busy', errorCode: 'max_concurrent_runs' },
      })),
    })
    expect(await new AutomationStore(maxed.face, sessionsFace().face).runNow(rule().id))
      .toBe('max_concurrent_runs')
    const failed = api({
      runNow: () => Promise.resolve(ok({ run: { id: 'run-1', outcome: 'failed' } })),
    })
    expect(await new AutomationStore(failed.face, sessionsFace().face).runNow(rule().id)).toBe('failed')
    const replaced = api({
      runNow: () => Promise.resolve(ok({
        run: { id: 'run-1', outcome: 'replaced', sessionId: 'session-1' },
      })),
    })
    const sessions = sessionsFace()
    expect(await new AutomationStore(replaced.face, sessions.face).runNow(rule().id)).toBeUndefined()
    expect(sessions.opened).toEqual([])
  })

  it('returns missing_session when the started Session never lands', async () => {
    const { face } = api()
    const store = new AutomationStore(face, sessionsFace([]).face, 5)
    expect(await store.runNow(rule().id)).toBe('missing_session')
  })

  it('returns the Host error message when a mutation is rejected', async () => {
    const { face } = api({
      create: () => Promise.resolve(fail('no workspace')),
      setEnabled: () => Promise.resolve(fail('cannot disable')),
      runNow: () => Promise.resolve(fail('busy')),
      delete: () => Promise.resolve(fail('missing')),
    })
    const store = new AutomationStore(face, sessionsFace().face)
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
    const store = new AutomationStore(face, sessionsFace().face)
    refreshIfLoaded(store)
    expect(calls).toEqual([])
    await store.load()
    refreshIfLoaded(store)
    await Promise.resolve()
    expect(calls.filter(name => name === 'list').length).toBeGreaterThan(1)
  })

  it('keeps a card without a count when listRuns fails', async () => {
    const { face } = api({
      listRuns: () => Promise.resolve(fail('no history')),
    })
    const store = new AutomationStore(face, sessionsFace().face)
    await store.load()
    expect(store.store.getSnapshot().items[0]).toEqual({ rule: rule() })
  })

  it('messageOf stringifies unknown rejections', () => {
    expect(messageOf(new Error('x'))).toBe('x')
    expect(messageOf('plain')).toBe('plain')
  })
})
