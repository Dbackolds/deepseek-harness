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
    expect(indexHasBootManifest('<!doctype html><title>DeepSeek Harness</title>')).toBe(false)
  })
})

describe('waitForBootManifest', () => {
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
