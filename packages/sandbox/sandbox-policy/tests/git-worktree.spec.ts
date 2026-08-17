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
    expect(described.dirtyCount).toBe(0)
    expect(described.unpushedCount).toBe(0)
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

  it('keeps remote-tracking names distinct from local heads and skips remote HEAD', async () => {
    const { cwd, session } = repo()
    git(cwd, ['remote', 'add', 'origin', cwd])
    git(cwd, ['update-ref', 'refs/remotes/origin/main', 'HEAD'])
    git(cwd, ['update-ref', 'refs/remotes/origin/HEAD', 'HEAD'])
    git(cwd, ['branch', 'zzz'])
    const described = await describeSessionGit(cwd, session)
    expect(described.branches.map(branch => branch.name)).toEqual(['main', 'zzz', 'origin/main'])
    expect(described.branches.find(branch => branch.name === 'origin/main')?.remote).toBe(true)
    expect(described.branches.some(branch => branch.name === 'HEAD' || branch.name === 'origin')).toBe(false)
    expect(described.branches[0]?.name).toBe('main')
  })

  it('labels a uniquely pointed detached HEAD with that ref name', async () => {
    const { cwd, session } = repo()
    git(cwd, ['checkout', '--detach', 'HEAD'])
    const described = await describeSessionGit(cwd, session)
    expect(described.workspaceBranch).toBeNull()
    expect(described.currentBranch).toBe('main')
  })

  it('labels an ambiguous detached HEAD with the short commit', async () => {
    const { cwd, session } = repo()
    git(cwd, ['branch', 'other'])
    git(cwd, ['checkout', '--detach', 'HEAD'])
    const described = await describeSessionGit(cwd, session)
    expect(described.workspaceBranch).toBeNull()
    expect(described.currentBranch).toMatch(/^[0-9a-f]{7,}$/)
    expect(described.currentBranch).not.toBe('HEAD')
    const same = await checkoutSessionBranch('ws-1', cwd, session, described.currentBranch)
    expect(same.isolated).toBe(false)
    expect(same.currentBranch).toBe(described.currentBranch)
  })

  it('counts uncommitted paths and unpushed commits on the current checkout', async () => {
    const { cwd, session } = repo()
    writeFileSync(join(cwd, 'dirty.txt'), 'x\n')
    writeFileSync(join(cwd, 'README.md'), 'changed\n')
    git(cwd, ['commit', '--allow-empty', '-m', 'ahead'])
    git(cwd, ['remote', 'add', 'origin', cwd])
    git(cwd, ['update-ref', 'refs/remotes/origin/main', 'HEAD~1'])
    git(cwd, ['branch', '--set-upstream-to=origin/main', 'main'])
    const described = await describeSessionGit(cwd, session)
    expect(described.dirtyCount).toBe(2)
    expect(described.unpushedCount).toBe(1)
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

  it('checks out a remote-tracking name without inventing a local branch', async () => {
    const { cwd, session } = repo()
    git(cwd, ['update-ref', 'refs/remotes/origin/topic', 'HEAD'])
    const checked = await checkoutSessionBranch('ws-1', cwd, session, 'origin/topic')
    expect(checked.currentBranch).toBe('origin/topic')
    expect(checked.isolated).toBe(true)
    expect(checked.branches.some(branch => branch.name === 'topic' && !branch.remote)).toBe(false)
  })
})
