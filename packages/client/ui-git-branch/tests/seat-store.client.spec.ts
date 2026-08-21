// @vitest-environment jsdom
/** GitBranchSeatController: load, checkout, and createBranch against a fake API. */
import { describe, expect, it } from 'vitest'
import { GitBranchSeatController } from '../src/client/seat-store.ts'

function ok<T>(value: T) {
  return { rpcId: 'r', result: { ok: true as const, value } }
}

function err(code: string, message: string) {
  return { rpcId: 'r', result: { ok: false as const, error: { code, message, details: {} } } }
}

describe('GitBranchSeatController', () => {
  it('loads the current session overlay', async () => {
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0,
      branches: [{ name: 'main', current: true, remote: false }],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(ok(view)),
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.load()
    expect(seat.store.getSnapshot()).toMatchObject({ sessionId: 's1', view, unavailable: false, error: null })
  })

  it('hides when the workspace is not a repository', async () => {
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(err('git-not-a-repository', 'not a repo')),
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.load()
    expect(seat.store.getSnapshot()).toMatchObject({ unavailable: true, view: null, error: null })
  })

  it('records a checkout overlay for this session', async () => {
    const next = {
      currentBranch: 'feature', detached: false, worktreePath: '/wt', isolated: true,
      dirtyCount: 0, unpushedCount: 0,
      branches: [{ name: 'feature', current: false, remote: false }],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(ok({ currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false, dirtyCount: 0, unpushedCount: 0, branches: [] })),
        checkout: () => Promise.resolve(ok(next)),
        createBranch: () => Promise.resolve(ok(next)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.checkout('feature')
    expect(seat.store.getSnapshot().view).toEqual(next)
  })

  it('resets when no session is current', async () => {
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(ok({ currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false, dirtyCount: 0, unpushedCount: 0, branches: [] })),
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => undefined, () => undefined)
    await seat.load()
    expect(seat.store.getSnapshot()).toMatchObject({ sessionId: '', view: null, unavailable: false })
    await seat.checkout('feature')
    expect(seat.store.getSnapshot().busy).toBe(false)
  })

  it('loads the workspace checkout when no session is current', async () => {
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0,
      branches: [{ name: 'main', current: true, remote: false }],
    }
    let described: unknown
    const seat = new GitBranchSeatController({
      git: {
        describe: (payload: unknown) => {
          described = payload
          return Promise.resolve(ok(view))
        },
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => undefined, () => 'ws-1')
    await seat.load()
    expect(described).toEqual({ workspaceId: 'ws-1' })
    expect(seat.store.getSnapshot()).toMatchObject({ sessionId: '', view, unavailable: false })
  })

  it('records a host error that is not a missing repository', async () => {
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(err('git-failed', 'boom')),
        checkout: () => Promise.resolve(err('git-failed', 'switch failed')),
        createBranch: () => Promise.resolve(err('git-branch-exists', 'taken')),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.load()
    expect(seat.store.getSnapshot()).toMatchObject({ unavailable: false, error: 'boom' })
    await seat.checkout('feature')
    expect(seat.store.getSnapshot().error).toBe('switch failed')
    await seat.createBranch('feature')
    expect(seat.store.getSnapshot().error).toBe('taken')
  })

  it('records a thrown describe or mutate failure', async () => {
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.reject(new Error('offline')),
        checkout: () => Promise.reject('raw'),
        createBranch: () => Promise.reject(new Error('create failed')),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.load()
    expect(seat.store.getSnapshot().error).toBe('offline')
    const workspaceOnly = new GitBranchSeatController({
      git: {
        describe: () => Promise.reject(new Error('offline')),
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => undefined, () => 'ws-1')
    await workspaceOnly.load()
    expect(workspaceOnly.store.getSnapshot().error).toBe('offline')
    await seat.checkout('feature')
    expect(seat.store.getSnapshot().error).toBe('raw')
    await seat.createBranch('feature')
    expect(seat.store.getSnapshot().error).toBe('create failed')
  })

  it('ignores a second mutate while one is busy', async () => {
    let release!: () => void
    const blocked = new Promise<{ rpcId: string; result: { ok: true; value: never } }>((resolve) => {
      release = () => resolve(ok({ currentBranch: 'a', detached: false, worktreePath: '/a', isolated: true, dirtyCount: 0, unpushedCount: 0, branches: [] } as never))
    })
    let calls = 0
    const seat = new GitBranchSeatController({
      git: {
        describe: () => Promise.resolve(ok({ currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false, dirtyCount: 0, unpushedCount: 0, branches: [] })),
        checkout: () => { calls += 1; return blocked },
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    const first = seat.checkout('a')
    await Promise.resolve()
    await seat.checkout('b')
    expect(calls).toBe(1)
    release()
    await first
    expect(seat.store.getSnapshot().view?.currentBranch).toBe('a')
  })

  it('syncs once for an unchanged session and workspace identity', async () => {
    let describes = 0
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0, branches: [],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: () => { describes += 1; return Promise.resolve(ok(view)) },
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    await seat.sync()
    await seat.sync()
    await seat.sync()
    expect(describes).toBe(1)
  })

  it('syncs again when the current session or workspace changes', async () => {
    let describes = 0
    let session: string | undefined = 's1'
    let workspace: string | undefined = 'ws-1'
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0, branches: [],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: () => { describes += 1; return Promise.resolve(ok(view)) },
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => session as never, () => workspace)
    await seat.sync()
    session = 's2'
    await seat.sync()
    workspace = 'ws-2'
    await seat.sync()
    expect(describes).toBe(3)
  })

  it('coalesces overlapping loads for the same identity', async () => {
    let describes = 0
    let release!: () => void
    const blocked = new Promise<{ rpcId: string; result: { ok: true; value: never } }>((resolve) => {
      release = () => resolve(ok({
        currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
        dirtyCount: 0, unpushedCount: 0, branches: [],
      } as never))
    })
    const seat = new GitBranchSeatController({
      git: {
        describe: () => { describes += 1; return blocked },
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => 's1' as never, () => 'ws-1')
    const first = seat.load()
    const second = seat.load()
    expect(describes).toBe(1)
    release()
    await Promise.all([first, second])
    expect(describes).toBe(1)
  })

  it('loads a session-only describe without a workspace id', async () => {
    let payload: unknown
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0, branches: [],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: (next: unknown) => { payload = next; return Promise.resolve(ok(view)) },
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => 's1' as never, () => undefined)
    await seat.load()
    expect(payload).toEqual({ sessionId: 's1' })
  })

  it('loads a workspace-only describe without a current session', async () => {
    let payload: unknown
    const view = {
      currentBranch: 'main', detached: false, worktreePath: '/repo', isolated: false,
      dirtyCount: 0, unpushedCount: 0, branches: [],
    }
    const seat = new GitBranchSeatController({
      git: {
        describe: (next: unknown) => { payload = next; return Promise.resolve(ok(view)) },
        checkout: () => Promise.resolve(ok(view)),
        createBranch: () => Promise.resolve(ok(view)),
      },
    } as never, () => undefined, () => 'ws-1')
    await seat.load()
    expect(payload).toEqual({ workspaceId: 'ws-1' })
  })

  it('drops a stale thrown describe after the identity already moved', async () => {
    const next = {
      currentBranch: 'next', detached: false, worktreePath: '/next', isolated: false,
      dirtyCount: 0, unpushedCount: 0, branches: [],
    }
    let session: string | undefined = 's1'
    let rejectOld!: (error: Error) => void
    const oldPending = new Promise<never>((_, reject) => { rejectOld = reject })
    const seat = new GitBranchSeatController({
      git: {
        describe: () => session === 's1' ? oldPending : Promise.resolve(ok(next)),
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => session as never, () => 'ws-1')
    const first = seat.load()
    session = 's2'
    await seat.load()
    rejectOld(new Error('offline'))
    await first.catch(() => undefined)
    expect(seat.store.getSnapshot().view).toEqual(next)
    expect(seat.store.getSnapshot().error).toBeNull()
  })

  it('drops a stale successful describe after the identity already moved', async () => {
    const views = {
      old: {
        currentBranch: 'old', detached: false, worktreePath: '/old', isolated: false,
        dirtyCount: 0, unpushedCount: 0, branches: [],
      },
      next: {
        currentBranch: 'next', detached: false, worktreePath: '/next', isolated: false,
        dirtyCount: 0, unpushedCount: 0, branches: [],
      },
    }
    let session: string | undefined = 's1'
    let releaseOld!: (value: ReturnType<typeof ok<(typeof views)['old']>>) => void
    const oldPending = new Promise<ReturnType<typeof ok<(typeof views)['old']>>>((resolve) => {
      releaseOld = resolve
    })
    const seat = new GitBranchSeatController({
      git: {
        describe: () => session === 's1' ? oldPending : Promise.resolve(ok(views.next)),
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => session as never, () => 'ws-1')
    const first = seat.load()
    session = 's2'
    await seat.load()
    releaseOld(ok(views.old))
    await first
    expect(seat.store.getSnapshot().view).toEqual(views.next)
  })

  it('drops a stale describe so it cannot clobber a newer snapshot', async () => {
    const views = {
      old: {
        currentBranch: 'old', detached: false, worktreePath: '/old', isolated: false,
        dirtyCount: 0, unpushedCount: 0, branches: [],
      },
      next: {
        currentBranch: 'next', detached: false, worktreePath: '/next', isolated: false,
        dirtyCount: 0, unpushedCount: 0, branches: [],
      },
    }
    let session: string | undefined = 's1'
    let releaseOld!: (value: ReturnType<typeof ok<(typeof views)['old']>>) => void
    const oldPending = new Promise<ReturnType<typeof ok<(typeof views)['old']>>>((resolve) => {
      releaseOld = resolve
    })
    const seat = new GitBranchSeatController({
      git: {
        describe: (_payload: unknown, signal?: AbortSignal) => {
          if (session === 's1') {
            return new Promise((resolve, reject) => {
              signal?.addEventListener('abort', () => {
                const error = new Error('aborted')
                error.name = 'AbortError'
                reject(error)
              })
              void oldPending.then(resolve)
            })
          }
          return Promise.resolve(ok(views.next))
        },
        checkout: () => Promise.resolve(ok({} as never)),
        createBranch: () => Promise.resolve(ok({} as never)),
      },
    } as never, () => session as never, () => 'ws-1')
    const first = seat.load()
    session = 's2'
    await seat.load()
    releaseOld(ok(views.old))
    await first.catch(() => undefined)
    expect(seat.store.getSnapshot().view).toEqual(views.next)
  })
})
