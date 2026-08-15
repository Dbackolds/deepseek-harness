/**
 * Spawn the local `dsh web` Host and wait for its readiness URL.
 * @module @deepseek-ai/dsh-desktop/host
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReadyChunk, type ReadyUrl } from './ready.ts'

/** How long the window waits for `dsh web: http://127.0.0.1:<port>`. */
const HOST_READY_TIMEOUT_MS = 60_000

/** One running Host and the loopback URL it announced. */
export interface StartedHost {
  /** Child process that owns the web profile. */
  child: ChildProcess
  /** Loopback URL the window may load. */
  ready: ReadyUrl
}

/**
 * Walk from this file to the repository root that contains `apps/cli`.
 * @param from - directory of the compiled or source module.
 * @returns the repository root.
 */
export function findRepoRoot(from: string): string {
  let current = from
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, 'apps', 'cli', 'package.json'))) return current
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  throw new Error('dsh desktop: cannot locate the repository root from the desktop app')
}

/**
 * Absolute Node locations probed when the Finder-launched process has no
 * Node on its short GUI `PATH`.
 */
const NODE_CANDIDATES = [
  '/usr/local/bin/node',
  '/opt/homebrew/bin/node',
  join(homedir(), '.volta', 'bin', 'node'),
  join(homedir(), '.asdf', 'shims', 'node'),
]

/**
 * Node used to boot `dsh web`. Electron's `process.execPath` is the shell
 * binary and cannot run the CLI.
 * @param remembered - last Node path persisted by a successful launch.
 * @returns an absolute Node executable, or `node` on PATH.
 */
export function resolveNodeExecutable(remembered?: string): string {
  const pinned = process.env.DSH_NODE_EXEC
  if (pinned !== undefined && pinned !== '' && existsSync(pinned)) return pinned
  if (remembered !== undefined && remembered !== '' && existsSync(remembered)) return remembered
  if (process.versions.electron === undefined) return process.execPath
  const fromNpm = process.env.npm_node_execpath
  if (fromNpm !== undefined && fromNpm !== '' && existsSync(fromNpm)) return fromNpm
  const probed = NODE_CANDIDATES.find(candidate => existsSync(candidate))
  if (probed !== undefined) return probed
  return 'node'
}

/**
 * Resolve the CLI entry used to boot `dsh web`.
 * Prefers the built `apps/cli/lib/bin.js`; falls back to the TypeScript source.
 * @param repoRoot - repository root.
 * @returns Node argv that starts with the bin path.
 */
export function resolveDshInvocation(repoRoot: string, rememberedNode?: string): { command: string; args: string[] } {
  const node = resolveNodeExecutable(rememberedNode)
  const built = join(repoRoot, 'apps', 'cli', 'lib', 'bin.js')
  if (existsSync(built)) return { command: node, args: [built] }
  const source = join(repoRoot, 'apps', 'cli', 'src', 'bin.ts')
  if (existsSync(source)) {
    return { command: node, args: ['--import', 'tsx/esm', source] }
  }
  throw new Error('dsh desktop: apps/cli is missing; run pnpm run build from the repository root')
}

/**
 * Start `dsh web --port 0` and resolve when the Host prints its URL.
 * @param options - working directory and extra web flags.
 * @returns the child and the announced loopback URL.
 */
export async function startWebHost(options: {
  cwd: string
  extraArgs?: readonly string[]
  timeoutMs?: number
  nodePath?: string
}): Promise<StartedHost> {
  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
  const invocation = resolveDshInvocation(repoRoot, options.nodePath)
  const extra = options.extraArgs ?? []
  const args = extra.includes('--port')
    ? [...invocation.args, 'web', ...extra]
    : [...invocation.args, 'web', '--port', '0', ...extra]
  const child = spawn(invocation.command, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const timeoutMs = options.timeoutMs ?? HOST_READY_TIMEOUT_MS
  return await new Promise<StartedHost>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      fail(new Error(`dsh desktop: timed out waiting for dsh web after ${String(timeoutMs)}ms`))
    }, timeoutMs)
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      process.stdout.write(text)
      const ready = parseReadyChunk(text)
      if (ready === undefined) return
      settle()
      resolve({ child, ready })
    }
    if (child.stdout === null || child.stderr === null) {
      child.kill()
      throw new Error('dsh desktop: dsh web stdio pipes are missing')
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      fail(new Error(`dsh desktop: dsh web exited before ready (code=${String(code)} signal=${String(signal)})`))
    }
    const settle = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.stderr.off('data', onData)
      child.off('error', fail)
      child.off('exit', onExit)
    }
    const fail = (error: Error): void => {
      settle()
      child.kill()
      reject(error)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.once('error', fail)
    child.once('exit', onExit)
  })
}

/**
 * Stop the Host process tree.
 * @param child - process started by {@link startWebHost}.
 */
export function stopWebHost(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32' && child.pid !== undefined) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    return
  }
  child.kill('SIGTERM')
}
