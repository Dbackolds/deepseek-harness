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
})
