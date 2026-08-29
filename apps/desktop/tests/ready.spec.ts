import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import { waitForBootManifest } from '../src/host.ts'
import { indexHasBootManifest, parseReadyChunk, parseReadyLine } from '../src/ready.ts'

describe('parseReadyLine', () => {
  it('extracts the loopback URL from the Host readiness line', () => {
    expect(parseReadyLine('dsh web: http://127.0.0.1:3080')).toEqual({
      href: 'http://127.0.0.1:3080',
      port: 3080,
    })
    expect(parseReadyLine('dsh web: http://127.0.0.1:4567 (LAN: http://192.168.1.5:4567)\n'))
      .toEqual({ href: 'http://127.0.0.1:4567', port: 4567 })
  })

  it('keeps the authentication token query in the parsed URL', () => {
    expect(parseReadyLine('dsh web: http://127.0.0.1:59050/?token=7NJ8jq6Uwj4VcqVtP-24C8zQ'))
      .toEqual({ href: 'http://127.0.0.1:59050/?token=7NJ8jq6Uwj4VcqVtP-24C8zQ', port: 59050 })
    expect(parseReadyLine('dsh web: http://127.0.0.1:59050/?token=abc_DEF-1 (LAN: http://192.168.1.5:59050)\n'))
      .toEqual({ href: 'http://127.0.0.1:59050/?token=abc_DEF-1', port: 59050 })
  })

  it('ignores unrelated Host logs', () => {
    expect(parseReadyLine('listening on 3080')).toBeUndefined()
    expect(parseReadyLine('dsh web: http://0.0.0.0:3080')).toBeUndefined()
    expect(parseReadyLine('dsh web: https://127.0.0.1:3080')).toBeUndefined()
  })
})

describe('parseReadyChunk', () => {
  it('returns the first readiness line in a multi-line chunk', () => {
    expect(parseReadyChunk('boot\ndsh web: http://127.0.0.1:4010\nmore\n'))
      .toEqual({ href: 'http://127.0.0.1:4010', port: 4010 })
    expect(parseReadyChunk('still starting\n')).toBeUndefined()
  })
})

describe('indexHasBootManifest', () => {
  it('accepts an index that already carries the Host boot graph', () => {
    expect(indexHasBootManifest('<script>window.__DSH_BOOT__ = {"rev":"1","entries":[]}</script>')).toBe(true)
    expect(indexHasBootManifest('<script>globalThis["__DSH_BOOT__"] = {"rev":"1","entries":[]}</script>')).toBe(true)
    expect(indexHasBootManifest('<!doctype html><title>DeepSeek Harness</title>')).toBe(false)
  })
})

describe('waitForBootManifest', () => {
  it('exchanges the readiness token for a session cookie and then polls the index', async () => {
    const requests: { url: string; cookie: string | null }[] = []
    const fetchImpl = async (url: string, init: { redirect: 'manual'; headers: Record<string, string> }) => {
      requests.push({ url, cookie: init.headers.cookie ?? null })
      if (url.includes('token=')) {
        return {
          status: 303,
          headers: { get: (name: string) => name === 'set-cookie' ? 'dsh-auth-x=v1.abc; Path=/; HttpOnly' : null },
          text: async () => '',
        }
      }
      const authenticated = requests.at(-1)?.cookie !== null
      return {
        status: 200,
        headers: { get: () => null },
        text: async () => authenticated
          ? '<script>window.__DSH_BOOT__ = {"rev":"1","entries":[]}</script>'
          : '<!doctype html><title>DeepSeek Harness</title>',
      }
    }
    await waitForBootManifest('http://127.0.0.1:59311/?token=abc123', 2_000, { fetchImpl })
    expect(requests[0]).toEqual({ url: 'http://127.0.0.1:59311/?token=abc123', cookie: null })
    expect(requests[1]).toEqual({ url: 'http://127.0.0.1:59311/', cookie: 'dsh-auth-x=v1.abc' })
  })

  it('rejects at once when the Host rejects the readiness token', async () => {
    const fetchImpl = async () => ({
      status: 401,
      headers: { get: () => null },
      text: async () => '',
    })
    await expect(waitForBootManifest('http://127.0.0.1:59311/?token=stale', 2_000, { fetchImpl }))
      .rejects.toThrow(/rejected its readiness token/)
  })

  it('resolves once a later poll returns the injected graph', async () => {
    let hits = 0
    const server = createServer((_req, res) => {
      hits += 1
      const body = hits < 3
        ? '<!doctype html><title>DeepSeek Harness</title>'
        : '<script>window.__DSH_BOOT__ = {"rev":"1","entries":[]}</script>'
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(body)
    })
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test server has no port')
    await waitForBootManifest(`http://127.0.0.1:${String(address.port)}/`, 2_000)
    expect(hits).toBeGreaterThanOrEqual(3)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  })

  it('rejects when the index never carries the graph', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<!doctype html><title>DeepSeek Harness</title>')
    })
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test server has no port')
    await expect(waitForBootManifest(`http://127.0.0.1:${String(address.port)}/`, 120))
      .rejects.toThrow(/timed out waiting for window\.__DSH_BOOT__/)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  })
})
