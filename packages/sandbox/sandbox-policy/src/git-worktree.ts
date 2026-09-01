/**
 * Host-side Git worktree manager for per-session branch isolation.
 *
 * Each session that leaves the workspace checkout gets a linked worktree
 * under `$DSH_HOME/worktrees/<workspace-id>/<session-id>`. The workspace
 * checkout stays the membership key; only the session overlay points at
 * the isolated tree.
 *
 * @module dsh-sandbox-policy/git-worktree
 */

import { spawn } from 'node:child_process'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { Session } from '@deepseek-ai/dsh-session'
import { effectiveWorktree, setSessionWorktree } from './session-worktree.ts'

/** One local or remote-tracking branch a workspace repository advertises. */
export interface GitBranchEntry {
  /** Local short name, or remote-tracking name including the remote. */
  readonly name: string
  /** True when this name is the repository current HEAD. */
  readonly current: boolean
  /** True when the name exists only as a remote-tracking branch. */
  readonly remote: boolean
}

/** Snapshot a session branch picker needs. */
export interface SessionGitState {
  /** Absolute repository root that owns the workspace checkout. */
  readonly repoRoot: string
  /** Branch currently checked out in the workspace, when HEAD is a branch. */
  readonly workspaceBranch: string | null
  /** Branch or detached label this session operates on. */
  readonly currentBranch: string
  /** True when this session checkout is not on a branch. */
  readonly detached: boolean
  /** Absolute directory this session operates in. */
  readonly worktreePath: string
  /** True when the session uses an isolated worktree rather than the workspace checkout. */
  readonly isolated: boolean
  /** Uncommitted paths in this session worktree, including untracked files. */
  readonly dirtyCount: number
  /** Commits on the current branch that the upstream does not have; 0 when there is no upstream. */
  readonly unpushedCount: number
  /** Local and remote-tracking branches, workspace HEAD first. */
  readonly branches: readonly GitBranchEntry[]
}

/** Failure a Git worktree operation reports to the wire. */
export class GitWorktreeError extends Error {
  constructor(
    message: string,
    readonly code: 'not-a-repository' | 'branch-not-found' | 'branch-invalid' | 'branch-exists' | 'dirty-worktree' | 'git-failed',
  ) {
    super(message)
    this.name = 'GitWorktreeError'
  }
}

const INVALID_BRANCH = /[\s~^:?*[\\]|]|@{|\.\.|\/\/|^\.|\.$|\/$|^\/|^-|^@$/

/** Successful describe snapshots keyed by worktree path and overlay branch. */
const describeCache = new Map<string, { at: number; value: SessionGitState }>()
/** Process-wide TTL used when a describe call does not pass `ttlMs`. Tests keep this 0. */
let describeCacheTtlMs = 0

/**
 * Options for {@link describeSessionGit}.
 */
export interface DescribeSessionGitOptions {
  /** Cache TTL in milliseconds. `0` disables. Defaults to {@link setGitDescribeCacheMs}. */
  ttlMs?: number
  /** Clock for TTL comparisons; tests inject this. */
  now?: number
}

/**
 * Set the process-wide describe cache TTL. The sandbox-policy plugin applies its
 * `gitDescribeCacheMs` config here. Direct tests leave the default `0` (disabled).
 * @param ttlMs - milliseconds to reuse a successful snapshot; `0` disables.
 */
export function setGitDescribeCacheMs(ttlMs: number): void {
  describeCacheTtlMs = ttlMs
}

/**
 * Drop cached describe snapshots. Checkout and createBranch call this so the
 * returned snapshot cannot show a pre-switch dirty or unpushed count.
 * @param path - when set, drop entries whose worktree path matches; otherwise drop all.
 */
export function invalidateGitDescribeCache(path?: string): void {
  if (path === undefined) {
    describeCache.clear()
    return
  }
  const resolved = resolve(path)
  for (const key of describeCache.keys()) {
    if (key === resolved || key.startsWith(`${resolved}\0`)) describeCache.delete(key)
  }
}

function describeCacheKey(worktreePath: string, overlayBranch: string | undefined): string {
  return overlayBranch === undefined ? worktreePath : `${worktreePath}\0${overlayBranch}`
}

/**
 * Whether a caller-supplied branch name is a legal Git ref name for this picker.
 * @param name - proposed branch name.
 * @returns true when the name can be used as a local branch.
 */
export function isValidBranchName(name: string): boolean {
  if (name.length === 0 || name.length > 255) return false
  if (name.startsWith('refs/')) return false
  return !INVALID_BRANCH.test(name)
}

/**
 * Run git with the given argv in cwd and return stdout on exit 0.
 * @param cwd - working directory for the child.
 * @param args - argv after git.
 * @returns trimmed stdout.
 */
async function git(cwd: string, args: readonly string[]): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => { stdout += chunk })
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    child.on('error', (error) => {
      /* v8 ignore next -- spawn fails only when git is not on PATH */
      reject(new GitWorktreeError(
        `git ${args.join(' ')} failed to start: ${error.message}`,
        'git-failed',
      ))
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(stdout.replace(/\r\n/g, '\n').replace(/\n+$/, ''))
        return
      }
      reject(new GitWorktreeError(
        stderr.trim() || stdout.trim() || `git ${args.join(' ')} exited ${String(code)}`,
        'git-failed',
      ))
    })
  })
}

/**
 * Discover the repository root that owns workspacePath, or throw
 * not-a-repository when Git is missing or the path is not a checkout.
 * @param workspacePath - workspace primary directory.
 * @returns absolute repository root.
 */
export async function discoverRepoRoot(workspacePath: string): Promise<string> {
  try {
    const root = await git(workspacePath, ['rev-parse', '--show-toplevel'])
    return resolve(root)
  } catch (error) {
    if (error instanceof GitWorktreeError) {
      throw new GitWorktreeError(
        `"${workspacePath}" is not a Git repository`,
        'not-a-repository',
      )
    }
    throw error
  }
}

/**
 * List local heads and remote-tracking branches for a repository.
 * @param repoRoot - absolute repository root.
 * @returns branch rows, workspace HEAD first.
 */
export async function listBranches(repoRoot: string): Promise<GitBranchEntry[]> {
  const raw = await git(repoRoot, [
    'for-each-ref',
    '--format=%(refname)%00%(refname:short)%00%(HEAD)',
    'refs/heads',
    'refs/remotes',
  ])
  const seen = new Set<string>()
  const branches: GitBranchEntry[] = []
  for (const line of raw.split('\n')) {
    if (line.length === 0) continue
    const [refname, name, head] = line.split('\0')
    if (refname === undefined || name === undefined || name.length === 0) continue
    if (refname === 'refs/heads/HEAD' || refname.endsWith('/HEAD')) continue
    const remote = refname.startsWith('refs/remotes/')
    if (seen.has(name)) continue
    seen.add(name)
    branches.push({ name, current: head === '*', remote })
  }
  branches.sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1
    if (left.remote !== right.remote) return left.remote ? 1 : -1
    return left.name.localeCompare(right.name)
  })
  return branches
}

/**
 * Branch currently checked out at path, or null when HEAD is detached.
 * @param path - checkout or worktree directory.
 * @returns branch name or null.
 */
export async function currentBranchOf(path: string): Promise<string | null> {
  try {
    const name = await git(path, ['rev-parse', '--abbrev-ref', 'HEAD'])
    return name === 'HEAD' ? null : name
  } catch {
    return null
  }
}

/**
 * Label for a detached checkout: a unique local or remote-tracking name at
 * the same commit, otherwise a shortened object id.
 * @param path - checkout or worktree directory.
 * @returns display name, or null when Git cannot name the commit.
 */
async function detachedCheckoutLabel(path: string): Promise<string | null> {
  let commit: string
  try {
    commit = await git(path, ['rev-parse', 'HEAD'])
  } catch {
    /* v8 ignore next -- describeSessionGit already proved this path is a Git checkout */
    return null
  }
  let raw = ''
  try {
    raw = await git(path, [
      'for-each-ref',
      `--points-at=${commit}`,
      '--format=%(refname)%00%(refname:short)',
      'refs/heads',
      'refs/remotes',
    ])
  } catch {
    /* v8 ignore next -- for-each-ref fails only when the checkout disappears mid-call */
    raw = ''
  }
  const names = raw.split('\n').flatMap((line) => {
    if (line.length === 0) return []
    const [refname, name] = line.split('\0')
    if (refname === undefined || name === undefined || name.length === 0) return []
    if (refname === 'refs/heads/HEAD' || refname.endsWith('/HEAD')) return []
    return [name]
  })
  const unique: string[] = []
  for (const name of names) {
    if (!unique.includes(name)) unique.push(name)
  }
  if (unique.length === 1) return unique[0] ?? null
  try {
    return await git(path, ['rev-parse', '--short', 'HEAD'])
  } catch {
    /* v8 ignore next -- HEAD was readable above; a later failure is a vanished checkout */
    return null
  }
}

/**
 * Count uncommitted paths, including untracked files, in one checkout.
 * @param path - checkout or worktree directory.
 * @returns path count, or 0 when status cannot be read.
 */
async function dirtyPathCount(path: string): Promise<number> {
  try {
    const raw = await git(path, ['status', '--porcelain', '-uall'])
    if (raw.length === 0) return 0
    return raw.split('\n').filter(line => line.length > 0).length
  } catch {
    return 0
  }
}

/**
 * Count commits on the current branch that the upstream does not have.
 * @param path - checkout or worktree directory.
 * @returns commit count, or 0 when there is no upstream.
 */
async function unpushedCommitCount(path: string): Promise<number> {
  try {
    const raw = await git(path, ['rev-list', '--count', '@{upstream}..HEAD'])
    const count = Number.parseInt(raw, 10)
    return Number.isFinite(count) ? count : 0
  } catch {
    return 0
  }
}

function worktreeHome(workspaceId: string, sessionId: string): string {
  return dshHomePath('worktrees', workspaceId, sessionId)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/**
 * Build the picker snapshot for one session against its workspace checkout.
 * @param workspacePath - workspace primary directory (header cwd).
 * @param session - live session whose overlay is folded.
 * @param options - cache TTL and optional clock.
 * @returns repository state, or throws not-a-repository.
 */
export async function describeSessionGit(
  workspacePath: string,
  session?: Pick<Session, 'snapshotEvents'>,
  options?: DescribeSessionGitOptions,
): Promise<SessionGitState> {
  const overlay = session === undefined ? undefined : effectiveWorktree(session.snapshotEvents())
  const worktreePath = resolve(overlay?.path ?? workspacePath)
  const ttlMs = options?.ttlMs ?? describeCacheTtlMs
  const now = options?.now ?? Date.now()
  const cacheKey = describeCacheKey(worktreePath, overlay?.branch)
  if (ttlMs > 0) {
    const hit = describeCache.get(cacheKey)
    if (hit !== undefined && now - hit.at < ttlMs) return hit.value
  }
  const repoRoot = await discoverRepoRoot(workspacePath)
  const workspaceBranch = await currentBranchOf(workspacePath)
  const checkoutBranch = workspaceBranch ?? await currentBranchOf(worktreePath)
  const currentBranch = overlay?.branch
    ?? checkoutBranch
    ?? (await detachedCheckoutLabel(worktreePath))
    ?? 'HEAD'
  const value: SessionGitState = {
    repoRoot,
    workspaceBranch,
    currentBranch,
    detached: checkoutBranch === null && overlay?.branch === undefined,
    worktreePath,
    isolated: overlay !== undefined && resolve(overlay.path) !== resolve(workspacePath),
    dirtyCount: await dirtyPathCount(worktreePath),
    unpushedCount: await unpushedCommitCount(worktreePath),
    branches: await listBranches(repoRoot),
  }
  if (ttlMs > 0) describeCache.set(cacheKey, { at: now, value })
  return value
}

/**
 * Ensure branch exists locally, creating it from HEAD or origin when needed.
 * @param repoRoot - absolute repository root.
 * @param branch - local branch name to ensure.
 */
async function refExists(repoRoot: string, ref: string): Promise<boolean> {
  try {
    await git(repoRoot, ['show-ref', '--verify', '--quiet', ref])
    return true
  } catch {
    return false
  }
}

async function ensureLocalBranch(repoRoot: string, branch: string): Promise<void> {
  if (await refExists(repoRoot, `refs/heads/${branch}`)) return
  if (await refExists(repoRoot, `refs/remotes/${branch}`)) return
  try {
    await git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`])
    /* v8 ignore next -- origin tracking is covered only when a remote exists */
    await git(repoRoot, ['branch', '--track', branch, `origin/${branch}`])
    /* v8 ignore next -- paired with the origin show-ref success path */
    return
  } catch {
    // No origin tracking branch either.
  }
  await git(repoRoot, ['branch', branch])
}

async function addWorktree(repoRoot: string, target: string, branch: string): Promise<void> {
  try {
    await git(repoRoot, ['worktree', 'add', '--checkout', target, branch])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    /* v8 ignore start -- second checkout of a branch already held by another worktree */
    if (/already checked out|already used by worktree/i.test(message)) {
      await git(repoRoot, ['worktree', 'add', '--detach', target, branch])
      await git(target, ['checkout', '--ignore-other-worktrees', branch])
      return
    }
    /* v8 ignore stop */
    throw new GitWorktreeError(message, 'git-failed')
  }
}

async function removeWorktree(repoRoot: string, path: string): Promise<void> {
  try {
    await git(repoRoot, ['worktree', 'remove', '--force', path])
  } catch {
    /* v8 ignore next -- force-remove leftover files when worktree remove itself fails */
    await rm(path, { recursive: true, force: true }).catch(() => undefined)
    /* v8 ignore next -- prune after a failed worktree remove */
    await git(repoRoot, ['worktree', 'prune']).catch(() => undefined)
  }
}

/**
 * Create or reuse this session isolated worktree and check branch out.
 * @param workspaceId - workspace id used in the worktree path.
 * @param workspacePath - workspace primary directory.
 * @param session - live session that receives the overlay event.
 * @param branch - branch to check out.
 * @returns the overlay that was recorded.
 */
export async function checkoutSessionBranch(
  workspaceId: string,
  workspacePath: string,
  session: Session,
  branch: string,
): Promise<SessionGitState> {
  if (!isValidBranchName(branch)) {
    throw new GitWorktreeError(`invalid branch name "${branch}"`, 'branch-invalid')
  }
  const repoRoot = await discoverRepoRoot(workspacePath)
  const workspaceBranch = await currentBranchOf(workspacePath)
    ?? await detachedCheckoutLabel(workspacePath)
  if (workspaceBranch === branch) {
    const overlay = effectiveWorktree(session.snapshotEvents())
    if (overlay !== undefined && resolve(overlay.path) !== resolve(workspacePath)) {
      await removeWorktree(repoRoot, overlay.path)
    }
    setSessionWorktree(session, { path: workspacePath, branch })
    invalidateGitDescribeCache(workspacePath)
    return describeSessionGit(workspacePath, session, { ttlMs: 0 })
  }

  await ensureLocalBranch(repoRoot, branch)
  const target = worktreeHome(workspaceId, session.id)
  await mkdir(dirname(target), { recursive: true })
  const existing = effectiveWorktree(session.snapshotEvents())
  if (existing !== undefined && resolve(existing.path) !== resolve(target)
    && resolve(existing.path) !== resolve(workspacePath)) {
    await removeWorktree(repoRoot, existing.path)
  }
  if (await pathExists(target)) {
    try {
      await git(target, ['checkout', '--ignore-other-worktrees', branch])
    } catch {
      await removeWorktree(repoRoot, target)
      await addWorktree(repoRoot, target, branch)
    }
  } else {
    await addWorktree(repoRoot, target, branch)
  }
  setSessionWorktree(session, { path: target, branch })
  invalidateGitDescribeCache(target)
  invalidateGitDescribeCache(workspacePath)
  return describeSessionGit(workspacePath, session, { ttlMs: 0 })
}

/**
 * Create a new local branch from the workspace HEAD and check it out in this
 * session isolated worktree.
 * @param workspaceId - workspace id used in the worktree path.
 * @param workspacePath - workspace primary directory.
 * @param session - live session that receives the overlay event.
 * @param branch - new branch name.
 * @returns the overlay that was recorded.
 */
export async function createSessionBranch(
  workspaceId: string,
  workspacePath: string,
  session: Session,
  branch: string,
): Promise<SessionGitState> {
  if (!isValidBranchName(branch)) {
    throw new GitWorktreeError(`invalid branch name "${branch}"`, 'branch-invalid')
  }
  const repoRoot = await discoverRepoRoot(workspacePath)
  try {
    await git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])
    throw new GitWorktreeError(`branch "${branch}" already exists`, 'branch-exists')
  } catch (error) {
    if (error instanceof GitWorktreeError && error.code === 'branch-exists') throw error
  }
  await git(repoRoot, ['branch', branch])
  return checkoutSessionBranch(workspaceId, workspacePath, session, branch)
}
