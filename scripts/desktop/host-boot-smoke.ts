/**
 * Boot-smoke a staged desktop Host tree: start `dsh web` from it, wait for
 * the readiness line, then assert zero loader failures and that key Remote
 * endpoints answer. This is the gate that keeps a broken archive (duplicate
 * composition ids, an incomplete deploy closure, a boot-time crash) from
 * ever being published: the desktop pack jobs run it against the staged
 * Host right after packaging, and the daily release automation treats a
 * smoke failure as a blocked release.
 *
 * @module scripts/desktop/host-boot-smoke
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { isEntry } from '../release/process.ts'

/** Budget for the Host to print its readiness line. */
const READY_TIMEOUT_MS = 90_000
/** Budget after readiness for the key Remote endpoints to answer. */
const PROBE_TIMEOUT_MS = 30_000
/** Lines whose presence in the Host output fails the smoke. */
/** Exported for the spec; the smoke fails the moment Host output matches one. */
export const FAILURE_PATTERNS = [/failed to import loader entry/u, /duplicate loader entry/u]

interface SmokeOptions {
  readonly hostRoot: string
}

interface SmokeResult {
  readonly ok: boolean
  readonly readyUrl: string | undefined
  readonly detail: string
}

function fail(child: ChildProcess, detail: string): SmokeResult {
  child.kill('SIGTERM')
  return { ok: false, readyUrl: undefined, detail }
}

/**
 * Boot the staged Host and probe its readiness and key endpoints.
 * @param options - the staged Host root (contains `dsh/lib/bin.js` and `node`).
 * @returns the smoke verdict; `ok` false means the pack must fail.
 */
export async function bootSmokeHost(options: SmokeOptions): Promise<SmokeResult> {
  const node = join(options.hostRoot, process.platform === 'win32' ? 'node.exe' : 'node')
  const bin = join(options.hostRoot, 'dsh', 'lib', 'bin.js')
  if (!existsSync(bin)) return { ok: false, readyUrl: undefined, detail: `missing ${bin}` }
  if (!existsSync(node)) return { ok: false, readyUrl: undefined, detail: `missing ${node}` }

  const child = spawn(node, [bin, 'web', '--port', '0', '--no-open'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const output: string[] = []
  const readyUrl = await new Promise<string>((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error(`no readiness line within ${String(READY_TIMEOUT_MS)}ms`)), READY_TIMEOUT_MS)
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      output.push(text)
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/?[^\s]*)/u.exec(text)
      if (match !== null && match[1] !== undefined) {
        clearTimeout(timer)
        child.stdout?.off('data', onData)
        child.stderr?.off('data', onData)
        resolvePromise(match[1])
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      const joined = output.join('')
      const broken = FAILURE_PATTERNS.find(pattern => pattern.test(joined))
      rejectPromise(new Error(`exited before readiness (code=${String(code)} signal=${String(signal)})${broken === undefined ? '' : `; Host output matched ${broken.source}`}`))
    })
  }).catch((error: unknown) => {
    child.kill('SIGTERM')
    const joined = output.join('')
    const broken = FAILURE_PATTERNS.find(pattern => pattern.test(joined))
    return {
      smokeError: true as const,
      message: error instanceof Error ? error.message : String(error),
      broken: broken?.source,
      output: joined.slice(-4000),
    }
  })
  if (typeof readyUrl !== 'string') {
    const failure = readyUrl
    const brokenNote = failure.broken === undefined ? '' : `; Host output matched ${failure.broken}`
    const outputNote = failure.output.trim() === '' ? '' : `; Host output tail:
${failure.output}`
    return { ok: false, readyUrl: undefined, detail: `${failure.message}${brokenNote}${outputNote}` }
  }

  try {
    if (!/[?&]token=/u.test(readyUrl)) return fail(child, 'readiness URL carries no token')
    const cookie = await authenticate(new URL(readyUrl), child)
    const base = new URL(readyUrl)
    const skills = await invoke(base, cookie, 'skills/list', { request: { sessionId: '' } })
    if (!skills.ok) return fail(child, `skills/list failed: ${JSON.stringify(skills).slice(0, 200)}`)
    const inventory = await invoke(base, cookie, 'pluginInventory/list', {})
    if (!inventory.ok) return fail(child, `pluginInventory/list failed: ${JSON.stringify(inventory).slice(0, 200)}`)
    return { ok: true, readyUrl, detail: `skills: ${String((skills.value as { skills?: unknown[] }).skills?.length ?? 0)}` }
  } catch (error) {
    return fail(child, error instanceof Error ? error.message : String(error))
  } finally {
    child.kill('SIGTERM')
  }
}

/**
 * Exchange the readiness token for the session cookie.
 * @param authUrl - readiness URL carrying the token query.
 * @param child - the Host process, killed when the handshake fails hard.
 * @returns the cookie pair to send on subsequent calls.
 */
async function authenticate(authUrl: URL, child: ChildProcess): Promise<string> {
  const deadline = Date.now() + PROBE_TIMEOUT_MS
  let lastError = 'no attempt'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(authUrl, { redirect: 'manual', headers: {} })
      if (response.status === 303) {
        const setCookie = response.headers.get('set-cookie')
        const cookiePair = setCookie?.split(';').find(part => part.trim() !== '')
        if (cookiePair === undefined) {
          lastError = '303 without set-cookie'
        } else {
          return cookiePair
        }
      } else if (response.status === 401) {
        lastError = 'token rejected with 401'
        break
      } else {
        lastError = `handshake status ${String(response.status)}`
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 200))
  }
  child.kill('SIGTERM')
  throw new Error(`token handshake failed: ${lastError}`)
}

interface InvokeValue {
  readonly ok: boolean
  readonly value?: unknown
}

/**
 * POST one Remote call against the running Host.
 * @param base - loopback base URL.
 * @param cookie - session cookie from the token handshake.
 * @param endpoint - `<namespace>/<method>` endpoint.
 * @param args - the single plain-object args field.
 * @returns the decoded result envelope.
 */
async function invoke(base: URL, cookie: string, endpoint: string, args: Record<string, unknown>): Promise<InvokeValue> {
  const response = await fetch(new URL(`/api/${endpoint}`, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: 'smoke', method: endpoint, payload: { args } }),
  })
  const envelope = JSON.parse(await response.text()) as { result?: InvokeValue }
  return envelope.result ?? { ok: false }
}

/** CLI entry: `pnpm exec tsx scripts/desktop/host-boot-smoke.ts --host <dir>`. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { host: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.host === undefined || values.host === '') {
    throw new Error('host-boot-smoke: --host is required (staged Host root with dsh/lib/bin.js)')
  }
  const result = await bootSmokeHost({ hostRoot: resolve(values.host) })
  if (!result.ok) throw new Error(`host-boot-smoke: FAILED: ${result.detail}`)
  console.log(`host-boot-smoke: OK (${result.detail})`)
}

if (isEntry(import.meta.url)) {
  await main()
}
