/** Host git-worktree manager against a real repository. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  checkoutSessionBranch, createSessionBranch, describeSessionGit, discoverRepoRoot,
  GitWorktreeError, isValidBranchName,
} from '../src/git-worktree.ts'

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true })
}

function repo(): { cwd: string; session: Session } {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-git-wt-')))
  git(cwd, ['init', '-b', 'main'])
  git(cwd, ['config', 'user.email', 'dev@example.com'])
  git(cwd, ['config', 'user.name', 'dev'])
  writeFileSync(join(cwd, 'README.md'), 'hello\n')
  git(cwd, ['add', '.'])
  git(cwd, ['commit', '-m', 'init'])
  const session = Session.create(SessionId('s1'), undefined, {
    version: 0, id: SessionId('s1'), createdAt: 0, cwd,
  })
  return { cwd, session }
}

describe('git-worktree manager', () => {
  it('describes the workspace checkout and isolates a created branch', async () => {
    const { cwd, session } = repo()
    const described = await describeSessionGit(cwd, session)
    expect(described.currentBranch).toBe('main')
    expect(described.isolated).toBe(false)
    const created = await createSessionBranch('ws-1', cwd, session, 'feature')
    expect(created.currentBranch).toBe('feature')
    expect(created.isolated).toBe(true)
    expect(created.worktreePath).not.toBe(cwd)
    const back = await checkoutSessionBranch('ws-1', cwd, session, 'main')
    expect(back.currentBranch).toBe('main')
    expect(back.isolated).toBe(false)
  })

  it('rejects an invalid or duplicate branch name', async () => {
    const { cwd, session } = repo()
    await expect(createSessionBranch('ws-1', cwd, session, 'has space'))
      .rejects.toMatchObject({ code: 'branch-invalid' })
    await createSessionBranch('ws-1', cwd, session, 'feature')
    await expect(createSessionBranch('ws-1', cwd, session, 'feature'))
      .rejects.toMatchObject({ code: 'branch-exists' })
    expect(isValidBranchName('feature')).toBe(true)
  })

  it('creates a missing local branch from HEAD when checking it out', async () => {
    const { cwd, session } = repo()
    const created = await checkoutSessionBranch('ws-1', cwd, session, 'fresh')
    expect(created.currentBranch).toBe('fresh')
    expect(created.isolated).toBe(true)
  })

  it('skips remote HEAD rows and keeps the first of a local/remote pair', async () => {
    const { cwd, session } = repo()
    git(cwd, ['remote', 'add', 'origin', cwd])
    git(cwd, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    git(cwd, ['update-ref', 'refs/remotes/origin/HEAD', 'HEAD'])
    git(cwd, ['branch', 'zzz'])
    const described = await describeSessionGit(cwd, session)
    expect(described.branches.filter(branch => branch.name === 'main')).toHaveLength(1)
    expect(described.branches.some(branch => branch.name === 'HEAD')).toBe(false)
    expect(described.branches[0]?.name).toBe('main')
  })

  it('rejects a path that is not a repository', async () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-git-empty-')))
    await expect(discoverRepoRoot(cwd)).rejects.toBeInstanceOf(GitWorktreeError)
  })

  it('rejects an invalid checkout name and reuses an existing isolated tree', async () => {
    const { cwd, session } = repo()
    await expect(checkoutSessionBranch('ws-1', cwd, session, 'has space'))
      .rejects.toMatchObject({ code: 'branch-invalid' })
    const first = await createSessionBranch('ws-1', cwd, session, 'feature')
    git(cwd, ['branch', 'other'])
    const second = await checkoutSessionBranch('ws-1', cwd, session, 'other')
    expect(second.currentBranch).toBe('other')
    expect(second.worktreePath).toBe(first.worktreePath)
  })
})
