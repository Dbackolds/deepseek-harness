/** Fold and write path for the per-session git/worktree overlay. */
import { describe, expect, it } from 'vitest'
import { Session, SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import {
  effectiveHome, effectiveWorktree, sessionWorkingDirectory, setSessionHome, setSessionWorktree,
} from '../src/session-worktree.ts'
import { isValidBranchName } from '../src/git-worktree.ts'

function session(id: string, cwd?: string): Session {
  const sessionId = SessionId(id)
  return Session.create(sessionId, undefined, {
    version: SESSION_FORMAT_VERSION,
    id: sessionId,
    createdAt: 0,
    isSeeded: false,
    ...cwd === undefined ? {} : { cwd },
  })
}

describe('session worktree overlay', () => {
  it('folds the last git/worktree event', () => {
    const active = session('s1', '/ws')
    active.append('sandbox/mode', { mode: 'read-only' } as never)
    setSessionWorktree(active, { path: '/wt/a', branch: 'a' })
    active.append('sandbox/mode', { mode: 'workspace-write' } as never)
    setSessionWorktree(active, { path: '/wt/b', branch: 'b' })
    expect(effectiveWorktree(active.snapshotEvents())).toEqual({ path: '/wt/b', branch: 'b' })
    expect(sessionWorkingDirectory(active)).toBe('/wt/b')
  })

  it('falls back to the header cwd without an overlay', () => {
    const active = session('s2', '/ws')
    expect(effectiveWorktree(active.snapshotEvents())).toBeUndefined()
    expect(effectiveHome(active.snapshotEvents())).toBeUndefined()
    expect(sessionWorkingDirectory(active)).toBe('/ws')
  })

  it('folds the last workspace/home or git/worktree by log time', () => {
    const active = session('s3', '/birth')
    setSessionHome(active, '/home-a')
    expect(effectiveHome(active.snapshotEvents())).toBe('/home-a')
    expect(sessionWorkingDirectory(active)).toBe('/home-a')
    setSessionWorktree(active, { path: '/wt', branch: 'feature' })
    expect(sessionWorkingDirectory(active)).toBe('/wt')
    setSessionHome(active, '/home-b')
    expect(effectiveHome(active.snapshotEvents())).toBe('/home-b')
    expect(sessionWorkingDirectory(active)).toBe('/home-b')
    expect(effectiveWorktree(active.snapshotEvents())).toEqual({ path: '/wt', branch: 'feature' })
  })
})

describe('isValidBranchName', () => {
  it('accepts ordinary feature names and rejects git-illegal ones', () => {
    expect(isValidBranchName('feature/ok')).toBe(true)
    expect(isValidBranchName('main')).toBe(true)
    expect(isValidBranchName('')).toBe(false)
    expect(isValidBranchName('-bad')).toBe(false)
    expect(isValidBranchName('has space')).toBe(false)
    expect(isValidBranchName('refs/heads/x')).toBe(false)
  })
})
