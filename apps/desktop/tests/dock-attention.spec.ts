import { deflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  applyCompletedDockIcon,
  bounceDockForCompleted,
  compositeDockBadgePng,
  decodeRgbaPng,
  DOCK_BADGE_FILL,
  encodeRgbaPng,
  overlayDockBadge,
  unreadCompletedBadgeLabel,
} from '../src/dock-attention.ts'

const here = dirname(fileURLToPath(import.meta.url))
const preload = readFileSync(join(here, '../src/preload.ts'), 'utf8')
const main = readFileSync(join(here, '../src/main.ts'), 'utf8')
const iconPng = readFileSync(join(here, '../assets/icon.png'))

describe('unreadCompletedBadgeLabel', () => {
  it('keeps 1–99 as digits and collapses 100+ to 99+', () => {
    expect(unreadCompletedBadgeLabel(1)).toBe('1')
    expect(unreadCompletedBadgeLabel(99)).toBe('99')
    expect(unreadCompletedBadgeLabel(100)).toBe('99+')
  })
})

describe('bounceDockForCompleted', () => {
  it('bounces informational once when a dock is present', () => {
    const bounce = vi.fn(() => 1)
    bounceDockForCompleted({ bounce })
    expect(bounce).toHaveBeenCalledWith('informational')
  })

  it('is a no-op without a dock', () => {
    expect(() => { bounceDockForCompleted(undefined) }).not.toThrow()
  })
})

describe('overlayDockBadge', () => {
  it('paints a green plate in the top-right corner', () => {
    const width = 32
    const height = 32
    const data = Buffer.alloc(width * height * 4, 0)
    overlayDockBadge(data, width, height, '1')
    const x = 30
    const y = 7
    const i = (y * width + x) * 4
    expect([...data.subarray(i, i + 4)]).toEqual([
      DOCK_BADGE_FILL.r, DOCK_BADGE_FILL.g, DOCK_BADGE_FILL.b, DOCK_BADGE_FILL.a,
    ])
    expect([...data.subarray(0, 4)]).toEqual([0, 0, 0, 0])
  })

  it('skips unknown glyphs instead of drawing a blank plate label', () => {
    const width = 32
    const height = 32
    const data = Buffer.alloc(width * height * 4, 0)
    overlayDockBadge(data, width, height, '')
    overlayDockBadge(data, width, height, '?')
    const x = 25
    const y = 7
    const i = (y * width + x) * 4
    expect([...data.subarray(i, i + 4)]).toEqual([
      DOCK_BADGE_FILL.r, DOCK_BADGE_FILL.g, DOCK_BADGE_FILL.b, DOCK_BADGE_FILL.a,
    ])
  })
})

describe('compositeDockBadgePng', () => {
  it('round-trips the packaged whale PNG with a count plate', () => {
    const marked = compositeDockBadgePng(iconPng, '99+')
    const decoded = decodeRgbaPng(marked)
    expect(decoded.width).toBe(256)
    expect(decoded.height).toBe(256)
    const x = 240
    const y = 58
    const i = (y * decoded.width + x) * 4
    expect([...decoded.data.subarray(i, i + 4)]).toEqual([
      DOCK_BADGE_FILL.r, DOCK_BADGE_FILL.g, DOCK_BADGE_FILL.b, DOCK_BADGE_FILL.a,
    ])
  })

  it('rejects a buffer that is not an 8-bit RGBA PNG', () => {
    expect(() => { decodeRgbaPng(Buffer.from('not a png')) }).toThrow(/not a PNG/)
  })

  it('rejects a truncated PNG chunk', () => {
    const truncated = Buffer.concat([
      iconPng.subarray(0, 8),
      Buffer.from([0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0]),
    ])
    expect(() => { decodeRgbaPng(truncated) }).toThrow(/truncated/)
  })

  it('rejects an IHDR payload shorter than 13 bytes', () => {
    const shortIhdr = Buffer.concat([
      iconPng.subarray(0, 8),
      pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8])),
      pngChunk('IEND', Buffer.alloc(0)),
    ])
    expect(() => { decodeRgbaPng(shortIhdr) }).toThrow(/truncated/)
  })

  it('rejects inflated scanlines that stop before the image height', () => {
    const short = encodeRgbaPng({ width: 1, height: 1, data: Buffer.from([1, 2, 3, 4]) })
    const shortScan = replaceIdat(short, deflateSync(Buffer.alloc(0)))
    expect(() => { decodeRgbaPng(shortScan) }).toThrow(/truncated/)
  })

  it('rejects a PNG that is not 8-bit RGBA', () => {
    const rgba = encodeRgbaPng({ width: 1, height: 1, data: Buffer.from([0, 0, 0, 255]) })
    const gray = Buffer.from(rgba)
    gray[25] = 0
    expect(() => { decodeRgbaPng(gray) }).toThrow(/8-bit RGBA/)
  })

  it('rejects a PNG that uses a scanline filter other than None', () => {
    const none = encodeRgbaPng({ width: 1, height: 1, data: Buffer.from([1, 2, 3, 4]) })
    const decoded = decodeRgbaPng(none)
    expect(decoded.data).toEqual(Buffer.from([1, 2, 3, 4]))
    const filtered = replaceIdat(none, deflateSync(Buffer.from([1, 1, 2, 3, 4])))
    expect(() => { decodeRgbaPng(filtered) }).toThrow(/unsupported PNG filter/)
  })
})

describe('applyCompletedDockIcon', () => {
  it('restores the unmarked icon at count 0 and does not bounce on a falling count', () => {
    const bounce = vi.fn(() => 1)
    const setIcon = vi.fn()
    applyCompletedDockIcon({ bounce }, setIcon, iconPng, 0, 2)
    expect(setIcon).toHaveBeenCalledWith(iconPng)
    expect(bounce).not.toHaveBeenCalled()
  })

  it('badges and bounces when the unread count rises', () => {
    const bounce = vi.fn(() => 1)
    const setIcon = vi.fn()
    applyCompletedDockIcon({ bounce }, setIcon, iconPng, 1, 0)
    expect(setIcon).toHaveBeenCalledOnce()
    const png = setIcon.mock.calls[0]?.[0] as Buffer
    expect(Buffer.isBuffer(png)).toBe(true)
    expect(png.equals(iconPng)).toBe(false)
    expect(bounce).toHaveBeenCalledWith('informational')
  })

  it('is a no-op without a dock icon setter', () => {
    const bounce = vi.fn(() => 1)
    applyCompletedDockIcon({ bounce }, undefined, iconPng, 1, 0)
    expect(bounce).not.toHaveBeenCalled()
  })
})

describe('desktop completed attention wiring', () => {
  it('exposes setCompletedUnread from the isolated preload', () => {
    expect(preload).toContain("setCompletedUnread: (count: number) => { ipcRenderer.send('dsh-desktop:set-completed-unread', count) }")
  })

  it('routes the completed IPC to the dock badge on macOS', () => {
    expect(main).toContain("ipcMain.on('dsh-desktop:set-completed-unread'")
    expect(main).toContain('applyCompletedDockIcon(')
    expect(main).toContain('requestSingleInstanceLock()')
  })
})

/**
 * Replace the first IDAT payload of a PNG, keeping the original IHDR.
 * @param png - source PNG.
 * @param idat - compressed scanline bytes.
 * @returns a new PNG buffer.
 */
function replaceIdat(png: Buffer, idat: Buffer): Buffer {
  let offset = 8
  const parts: Buffer[] = [png.subarray(0, 8)]
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('latin1', offset + 4, offset + 8)
    const end = offset + 12 + length
    if (type === 'IDAT') {
      parts.push(pngChunk('IDAT', idat))
    } else {
      parts.push(png.subarray(offset, end))
    }
    offset = end
    if (type === 'IEND') break
  }
  return Buffer.concat(parts)
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  body.copy(chunk, 4)
  let crc = 0xffffffff
  for (let i = 0; i < body.length; i += 1) {
    crc = CRC_TABLE[(crc ^ (body[i] ?? 0)) & 255] ^ (crc >>> 8)
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length)
  return chunk
}
