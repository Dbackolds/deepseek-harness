/** Standalone reboot watchdog. No Cordis imports. */

import { spawn } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

interface RebootSpec {
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

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function waitWhile(check: () => Promise<boolean> | boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await check())) return true
    await sleep(200)
  }
  return !(await check())
}

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(500) })
    return true
  } catch {
    return false
  }
}

async function main(): Promise<number> {
  const specPath = process.argv[2]
  if (specPath === undefined) return 1
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as RebootSpec
  const parentGone = await waitWhile(() => alive(spec.parentPid), spec.parentTimeoutMs)
  if (!parentGone) return 1
  const healthUrl = spec.healthUrl
  if (healthUrl !== undefined) {
    await waitWhile(() => reachable(healthUrl), 5_000)
  }
  const child = spawn(spec.execPath, [...spec.execArgv, ...spec.argv], {
    cwd: spec.cwd,
    env: spec.env,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  if (child.pid === undefined) return 1
  child.unref()
  const childPid = child.pid
  const up = await waitWhile(async () => {
    if (!alive(childPid)) return true
    if (healthUrl === undefined) return false
    return !(await reachable(healthUrl))
  }, spec.childTimeoutMs)
  try { unlinkSync(specPath) } catch { /* spec already gone */ }
  return up && alive(childPid) ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  void main().then((code) => { process.exit(code) }, () => { process.exit(1) })
}
