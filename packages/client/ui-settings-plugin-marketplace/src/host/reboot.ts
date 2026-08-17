/** Spawn the reboot watchdog after it is confirmed alive. */

import { spawn } from 'node:child_process'
import { chmodSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const REBOOT_ENV = 'DSH_MARKETPLACE_REBOOT'

export interface RebootSpec {
  readonly parentPid: number
  readonly execPath: string
  readonly execArgv: readonly string[]
  readonly argv: readonly string[]
  readonly cwd: string
  readonly env: Record<string, string>
  readonly healthUrl?: string
  readonly parentTimeoutMs: number
  readonly childTimeoutMs: number
}

export const DESKTOP_HOST_ENV = 'DSH_DESKTOP'

export function rebootBlocked(_now = Date.now(), _env: NodeJS.ProcessEnv = process.env): string | undefined {
  return undefined
}

/** Whether this Host is owned by the desktop window. `/reboot` then only exits. */
export function desktopOwnsHost(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[DESKTOP_HOST_ENV] === '1'
}

/**
 * Desktop starts `dsh web --port 0`. Restarting with that argv gets a new
 * OS port and leaves the Electron window on the dead URL. Pin the live port.
 */
export function argvWithPort(argv: readonly string[], port?: number): string[] {
  const next = [...argv]
  if (port === undefined) return next
  const flag = next.findIndex(arg => arg === '--port' || arg.startsWith('--port='))
  if (flag === -1) return [...next, '--port', String(port)]
  if (next[flag] === '--port') {
    const flagged = next[flag + 1]
    if (flagged !== undefined && !flagged.startsWith('-')) {
      next[flag + 1] = String(port)
      return next
    }
    next.splice(flag + 1, 0, String(port))
    return next
  }
  next[flag] = `--port=${String(port)}`
  return next
}

export function buildRebootSpec(options: {
  port?: number
  now?: number
}): RebootSpec {
  const now = options.now ?? Date.now()
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  env[REBOOT_ENV] = String(now)
  return {
    parentPid: process.pid,
    execPath: process.execPath,
    execArgv: [...process.execArgv],
    argv: argvWithPort(process.argv.slice(1), options.port),
    cwd: process.cwd(),
    env,
    ...(options.port !== undefined ? { healthUrl: `http://127.0.0.1:${String(options.port)}/` } : {}),
    parentTimeoutMs: 30_000,
    childTimeoutMs: 30_000,
  }
}

export function writeRebootSpec(spec: RebootSpec): string {
  const path = join(tmpdir(), `dsh-marketplace-reboot-${String(spec.parentPid)}-${spec.env[REBOOT_ENV]}.json`)
  writeFileSync(path, `${JSON.stringify(spec)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function waitUntil(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  return check()
}

export async function startWatchdog(watchdogPath: string, specPath: string): Promise<
  { readonly ok: true; readonly pid: number } | { readonly ok: false; readonly message: string }
> {
  const child = spawn(process.execPath, [watchdogPath, specPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  const watchdogPid = child.pid
  if (watchdogPid === undefined) {
    return { ok: false, message: '无法拉起重启看门狗' }
  }
  child.unref()
  const alive = await waitUntil(() => processAlive(watchdogPid), 2_000)
  if (!alive) return { ok: false, message: '看门狗在交接前就退出了' }
  return { ok: true, pid: watchdogPid }
}
