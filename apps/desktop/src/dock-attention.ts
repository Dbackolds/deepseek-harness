/**
 * macOS dock badge and bounce for unread Completed reminders.
 * @module @deepseek-ai/dsh-desktop/dock-attention
 */

import { deflateSync, inflateSync } from 'node:zlib'

/** Electron dock face used by the bounce helper. */
export interface DockBounce {
  bounce(type?: 'critical' | 'informational'): number
}

/** Install a PNG as the current dock icon. */
export type DockIconSetter = (png: Buffer) => void

/** Success-green fill for the unread Completed plate. */
export const DOCK_BADGE_FILL = { r: 52, g: 199, b: 89, a: 255 }
/** Knocked-out count ink on the green plate. */
export const DOCK_BADGE_INK = { r: 255, g: 255, b: 255, a: 255 }

/**
 * Compact count for the dock plate: 1–99 stay digits; 100+ collapses to 99+.
 * @param count - unread Completed count.
 * @returns the badge label.
 */
export function unreadCompletedBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/**
 * Bounce the dock icon once. Informational bounce lasts about one second.
 * Electron returns -1 while the app is focused; that result is ignored.
 * @param dock - `app.dock` on darwin, or `undefined` on other platforms.
 */
export function bounceDockForCompleted(dock: DockBounce | undefined): void {
  dock?.bounce('informational')
}

/**
 * Apply the unread Completed count to the dock icon. Count 0 restores the
 * unmarked whale. A rising count also bounces once.
 * @param dock - `app.dock` on darwin, or `undefined` on other platforms.
 * @param setIcon - installs a PNG as the current dock icon, or `undefined` off darwin.
 * @param basePng - unmarked whale PNG.
 * @param count - listed Sessions that still carry the Completed reminder.
 * @param previousCount - last published count, used to decide whether to bounce.
 */
export function applyCompletedDockIcon(
  dock: DockBounce | undefined,
  setIcon: DockIconSetter | undefined,
  basePng: Buffer,
  count: number,
  previousCount: number,
): void {
  if (setIcon === undefined) return
  setIcon(count <= 0 ? basePng : compositeDockBadgePng(basePng, unreadCompletedBadgeLabel(count)))
  if (count > previousCount) bounceDockForCompleted(dock)
}

/**
 * Overlay a green count plate on the top-right of the whale PNG.
 * @param basePng - unmarked PNG bytes (8-bit RGBA).
 * @param label - compact count text.
 * @returns PNG bytes with the plate composited in.
 */
export function compositeDockBadgePng(basePng: Buffer, label: string): Buffer {
  const png = decodeRgbaPng(basePng)
  overlayDockBadge(png.data, png.width, png.height, label)
  return encodeRgbaPng(png)
}

/**
 * Draw the green plate and count onto an RGBA buffer.
 * @param data - RGBA pixels, row-major.
 * @param width - image width.
 * @param height - image height.
 * @param label - compact count text.
 */
export function overlayDockBadge(
  data: Buffer,
  width: number,
  height: number,
  label: string,
): void {
  const diameter = Math.round(width * 0.38)
  const radius = diameter / 2
  const cx = width - radius - Math.round(width * 0.04)
  const cy = radius + Math.round(height * 0.04)
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(width - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy > radius * radius) continue
      const i = (y * width + x) * 4
      data[i] = DOCK_BADGE_FILL.r
      data[i + 1] = DOCK_BADGE_FILL.g
      data[i + 2] = DOCK_BADGE_FILL.b
      data[i + 3] = DOCK_BADGE_FILL.a
    }
  }
  blitLabel(data, width, height, cx, cy, radius, label)
}

/**
 * Stamp the compact count onto the green plate with a 5×7 bitmap font.
 * @param data - RGBA buffer.
 * @param width - image width.
 * @param height - image height.
 * @param cx - plate center x.
 * @param cy - plate center y.
 * @param radius - plate radius.
 * @param label - compact count text.
 */
function blitLabel(
  data: Buffer,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  label: string,
): void {
  const glyphs = [...label].map(ch => GLYPHS[ch]).filter((rows): rows is readonly number[] => rows !== undefined)
  if (glyphs.length === 0) return
  const gap = 1
  const glyphWidth = 5
  const glyphHeight = 7
  const contentWidth = glyphs.length * glyphWidth + (glyphs.length - 1) * gap
  const scale = Math.max(1, Math.floor((radius * 1.2) / Math.max(contentWidth, glyphHeight)))
  const totalWidth = contentWidth * scale
  const totalHeight = glyphHeight * scale
  const originX = Math.round(cx - totalWidth / 2)
  const originY = Math.round(cy - totalHeight / 2)
  let cursor = originX
  for (const rows of glyphs) {
    rows.forEach((bits, row) => {
      for (let col = 0; col < glyphWidth; col += 1) {
        if (((bits >> (glyphWidth - 1 - col)) & 1) === 0) continue
        fillRect(data, width, height, cursor + col * scale, originY + row * scale, scale, scale)
      }
    })
    cursor += (glyphWidth + gap) * scale
  }
}

/**
 * Fill one axis-aligned rectangle with badge ink.
 * @param data - RGBA buffer.
 * @param width - image width.
 * @param height - image height.
 * @param x0 - left.
 * @param y0 - top.
 * @param w - width in pixels.
 * @param h - height in pixels.
 */
function fillRect(
  data: Buffer,
  width: number,
  height: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): void {
  const x1 = Math.min(width, x0 + w)
  const y1 = Math.min(height, y0 + h)
  for (let y = Math.max(0, y0); y < y1; y += 1) {
    for (let x = Math.max(0, x0); x < x1; x += 1) {
      const i = (y * width + x) * 4
      data[i] = DOCK_BADGE_INK.r
      data[i + 1] = DOCK_BADGE_INK.g
      data[i + 2] = DOCK_BADGE_INK.b
      data[i + 3] = DOCK_BADGE_INK.a
    }
  }
}

/** 5×7 bitmap rows for the dock count (MSB is the leftmost pixel). */
const GLYPHS: Record<string, readonly number[]> = {
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Decoded 8-bit RGBA PNG. */
export interface RgbaPng {
  width: number
  height: number
  data: Buffer
}

/**
 * Decode an 8-bit RGBA PNG into a row-major buffer.
 * @param png - PNG bytes.
 * @returns width, height, and RGBA pixels.
 */
export function decodeRgbaPng(png: Buffer): RgbaPng {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('dsh desktop: dock icon is not a PNG')
  }
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []
  let offset = 8
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('latin1', offset + 4, offset + 8)
    const start = offset + 8
    const end = start + length
    if (end + 4 > png.length) throw new Error('dsh desktop: dock icon PNG is truncated')
    const chunk = png.subarray(start, end)
    if (type === 'IHDR') {
      if (chunk.length < 13) throw new Error('dsh desktop: dock icon PNG is truncated')
      width = chunk.readUInt32BE(0)
      height = chunk.readUInt32BE(4)
      bitDepth = chunk[8]
      colorType = chunk[9]
    } else if (type === 'IDAT') {
      idat.push(chunk)
    } else if (type === 'IEND') {
      break
    }
    offset = end + 4
  }
  if (bitDepth !== 8 || colorType !== 6 || width < 1 || height < 1) {
    throw new Error('dsh desktop: dock icon PNG must be 8-bit RGBA')
  }
  const inflated = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const data = Buffer.alloc(height * stride)
  let src = 0
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src]
    if (filter === undefined) throw new Error('dsh desktop: dock icon PNG is truncated')
    src += 1
    const row = inflated.subarray(src, src + stride)
    src += stride
    const out = data.subarray(y * stride, (y + 1) * stride)
    if (filter !== 0) throw new Error(`dsh desktop: unsupported PNG filter ${String(filter)}`)
    row.copy(out)
  }
  return { width, height, data }
}

/**
 * Encode an 8-bit RGBA image as a PNG.
 * @param png - width, height, and RGBA pixels.
 * @returns PNG bytes.
 */
export function encodeRgbaPng(png: RgbaPng): Buffer {
  const { width, height, data } = png
  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y += 1) {
    const dest = y * (stride + 1)
    raw[dest] = 0
    data.copy(raw, dest + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Build one PNG chunk with CRC.
 * @param type - four-character chunk type.
 * @param data - chunk payload.
 * @returns length + type + data + CRC.
 */
function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  body.copy(chunk, 4)
  chunk.writeUInt32BE(crc32(body), 8 + data.length)
  return chunk
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

/**
 * PNG CRC-32 over a buffer.
 * @param data - bytes to checksum.
 * @returns unsigned CRC.
 */
function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
