/**
 * Spawn the local `dsh web` Host and wait for its readiness URL.
 * @module @deepseek-ai/dsh-desktop/host
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexHasBootManifest, parseReadyChunk, type ReadyUrl } from './ready.ts'

/** How long the window waits for `dsh web: http://127.0.0.1:<port>`. */
const HOST_READY_TIMEOUT_MS = 60_000
/** How long the window waits after that line for `/plugins` to answer. */
const PLUGIN_ROUTE_TIMEOUT_MS = 15_000
/** Client bundle probed so the window does not load a Host that still 404s plugins. */
const PLUGIN_PROBE_PATH = '/plugins/%40deepseek-ai/dsh-client-modules/client.js'

/** How often the window re-reads `/` while waiting for `window.__DSH_BOOT__`. */
const BOOT_MANIFEST_POLL_MS = 50

/** One running Host and the loopback URL it announced. */
export interface StartedHost {
  /** Child process that owns the web profile. */
  child: ChildProcess
  /** Loopback URL the window may load. */
  ready: ReadyUrl
}

/** Node argv that starts `dsh web`. */
export interface DshInvocation {
  /** Node executable that can run the CLI. */
  command: string
  /** Arguments that start with the CLI entry path. */
  args: string[]
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
 * Packaged Host tree written next to the Electron app by `scripts/desktop/pack.ts`.
 * electron-builder copies `extraResources/host` to `process.resourcesPath/host`.
 * @param resourcesPath - Electron `process.resourcesPath`, or an explicit test path.
 * @returns the packaged Host root, or `undefined` when this is a checkout launch.
 */
export function packagedHostRoot(resourcesPath?: string): string | undefined {
  const base = resourcesPath ?? electronResourcesPath()
  if (base === undefined) return undefined
  const root = join(base, 'host')
  return existsSync(join(root, 'dsh', 'lib', 'bin.js')) ? root : undefined
}

/**
 * Electron `process.resourcesPath`, absent when this module runs under plain Node.
 * @returns the resources directory, or `undefined` outside Electron.
 */
function electronResourcesPath(): string | undefined {
  const value = (process as NodeJS.Process & { resourcesPath?: unknown }).resourcesPath
  return typeof value === 'string' && value !== '' ? value : undefined
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
 * @param packagedRoot - packaged Host tree, when this is a release build.
 * @returns an absolute Node executable, or `node` on PATH.
 */
export function resolveNodeExecutable(remembered?: string, packagedRoot?: string): string {
  const pinned = process.env.DSH_NODE_EXEC
  if (pinned !== undefined && pinned !== '' && existsSync(pinned)) return pinned
  if (packagedRoot !== undefined) {
    const bundled = join(packagedRoot, process.platform === 'win32' ? 'node.exe' : 'node')
    if (existsSync(bundled)) return bundled
  }
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
 * A release build uses the packaged Host; a checkout prefers the built
 * `apps/cli/lib/bin.js` and falls back to the TypeScript source.
 * @param from - directory of the compiled or source module.
 * @param rememberedNode - last Node path persisted by a successful launch.
 * @returns Node argv that starts with the bin path.
 */
export function resolveDshInvocation(from: string, rememberedNode?: string): DshInvocation {
  const packaged = packagedHostRoot()
  if (packaged !== undefined) {
    return {
      command: resolveNodeExecutable(rememberedNode, packaged),
      args: [join(packaged, 'dsh', 'lib', 'bin.js')],
    }
  }
  const repoRoot = findRepoRoot(from)
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
 * Wait until the Host serves a client plugin bundle.
 * The readiness line only means the HTTP server bound; later rows still
 * register `/plugins`. Loading the GUI before that 404s the first scripts.
 * @param href - loopback origin printed by `dsh web`.
 * @param options - timeout and fetch hook for tests.
 */
export async function waitForPluginRoute(
  href: string,
  options: {
    timeoutMs?: number
    fetchImpl?: (url: string, init: { method: 'GET' }) => Promise<{ ok: boolean }>
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? PLUGIN_ROUTE_TIMEOUT_MS
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  const url = `${href.replace(/\/$/u, '')}${PLUGIN_PROBE_PATH}`
  const deadline = Date.now() + timeoutMs
  let lastError: Error | undefined
  while (Date.now() < deadline) {
    try {
      // `/plugins` answers GET. A HEAD probe would 405 forever and leave the
      // window on the blank loading page after the timeout.
      const response = await fetchImpl(url, { method: 'GET' })
      if (response.ok) return
      lastError = new Error(`dsh desktop: plugin route ${url} returned a non-OK status`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw lastError ?? new Error(`dsh desktop: timed out waiting for plugin route at ${url}`)
}

/**
 * True when `port` is a usable TCP listen port, excluding OS-assigned `0`.
 * @param port - candidate from launch memory or a Host readiness URL.
 * @returns whether the value can be reused as `--port`.
 */
export function isReusableListenPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * Whether `127.0.0.1:<port>` accepts a new listener right now.
 * Used only to decide between a remembered origin and `--port 0`; a later
 * bind race still fails the Host loudly.
 * @param port - remembered loopback port.
 * @returns true when this process could bind that port.
 */
export function listenPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => {
      server.close()
      resolve(false)
    })
    server.listen(port, '127.0.0.1', () => {
      server.close(() => { resolve(true) })
    })
  })
}

/**
 * Choose `--port` for the Host this window will load.
 * An explicit `--port` in extra args wins. Otherwise reuse the last successful
 * loopback port so Chromium keeps the same origin (and therefore the same
 * localStorage) across restarts. Occupied or invalid remembered ports select `0`.
 * @param extraArgs - flags forwarded to `dsh web`.
 * @param rememberedPort - last successful Host port, when one exists.
 * @returns argv after the CLI entry, starting with `web`.
 */
export function webHostArgs(extraArgs: readonly string[] = [], rememberedPort?: number): string[] {
  if (extraArgs.includes('--port')) return ['web', ...extraArgs]
  const port = isReusableListenPort(rememberedPort) ? String(rememberedPort) : '0'
  return ['web', '--port', port, ...extraArgs]
}

/**
 * Start `dsh web` and resolve when `/` carries `window.__DSH_BOOT__`.
 * The readiness line means the HTTP server is listening; the modules row
 * injects the boot graph later. Loading before that marker leaves the
 * window on a blank page.
 * @param options - working directory, extra web flags, and the last successful port.
 * @returns the child and the announced loopback URL.
 */
export async function startWebHost(options: {
  cwd: string
  extraArgs?: readonly string[]
  timeoutMs?: number
  nodePath?: string
  port?: number
}): Promise<StartedHost> {
  const invocation = resolveDshInvocation(dirname(fileURLToPath(import.meta.url)), options.nodePath)
  const extra = options.extraArgs ?? []
  const remembered = isReusableListenPort(options.port) && await listenPortAvailable(options.port)
    ? options.port
    : undefined
  const args = [...invocation.args, ...webHostArgs(extra, remembered)]
  const child = spawn(invocation.command, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const timeoutMs = options.timeoutMs ?? HOST_READY_TIMEOUT_MS
  const ready = await new Promise<ReadyUrl>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      fail(new Error(`dsh desktop: timed out waiting for dsh web after ${String(timeoutMs)}ms`))
    }, timeoutMs)
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      process.stdout.write(text)
      const parsed = parseReadyChunk(text)
      if (parsed === undefined) return
      settle()
      resolve(parsed)
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
  const remainingMs = Math.max(1_000, timeoutMs - 1_000)
  await waitForBootManifest(ready.href, remainingMs)
  return { child, ready }
}

/**
 * Poll the Host index until the modules row has injected the boot graph.
 * @param href - loopback origin printed on the readiness line.
 * @param timeoutMs - remaining supervisor budget.
 */
export async function waitForBootManifest(href: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(href, { redirect: 'follow' })
      const html = await response.text()
      if (response.ok && indexHasBootManifest(html)) return
      lastError = new Error(`dsh desktop: ${href} returned HTTP ${String(response.status)} without a boot manifest`)
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, BOOT_MANIFEST_POLL_MS))
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'no response')
  throw new Error(`dsh desktop: timed out waiting for window.__DSH_BOOT__ at ${href}: ${detail}`)
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
