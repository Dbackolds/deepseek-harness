import { describe, expect, it } from 'vitest'
import { parseReadyChunk, parseReadyLine } from '../src/ready.ts'

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
