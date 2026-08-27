import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { detectVideo } from '../src/video.ts'
import { MKV, MP4, MOV, WEBM, ebmlHeader, ftypBox } from './video-fixtures.ts'

const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3])

/** Assert detectVideo refuses bytes with the stable admission code and message. */
function expectRefused(data: Uint8Array, code: string, message: string): void {
  try {
    detectVideo(data)
    expect.unreachable('detectVideo accepted bytes it must refuse')
  } catch (error) {
    expect(error).toMatchObject({ code, message })
  }
}

describe('video container sniffing', () => {
  it('detects every accepted container from its header', () => {
    expect(detectVideo(MP4)).toBe('video/mp4')
    expect(detectVideo(ftypBox('mp42'))).toBe('video/mp4')
    expect(detectVideo(MOV)).toBe('video/quicktime')
    expect(detectVideo(MKV)).toBe('video/x-matroska')
  })

  it('rejects WebM as a recognized but unaccepted container', () => {
    expectRefused(WEBM, 'UNSUPPORTED_VIDEO_TYPE', 'WebM video containers are not accepted.')
  })

  it('rejects garbage bytes, empty payloads, and short ftyp prefixes', () => {
    expectRefused(
      Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    expectRefused(new Uint8Array(0), 'INVALID_VIDEO', 'Unsupported or malformed video data.')
    // A box whose declared length promises an ftyp brand the bytes never deliver.
    expectRefused(
      Uint8Array.of(0, 0, 0, 0x0c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // Exactly twelve bytes carry a complete brand and sniff cleanly.
    expect(detectVideo(MP4.subarray(0, 12))).toBe('video/mp4')
  })

  it('rejects EBML headers whose doc type is neither matroska nor webm', () => {
    expectRefused(ebmlHeader('zzzz'), 'INVALID_VIDEO', 'Unsupported or malformed video data.')
  })

  it('rejects truncated EBML structures at every parse boundary', () => {
    expectRefused(Uint8Array.of(0x1a, 0x45), 'INVALID_VIDEO', 'Unsupported or malformed video data.')
    // Zero first byte: an invalid EBML variable-length integer marker.
    expectRefused(
      Uint8Array.from([...EBML_MAGIC, 0x00]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // Header size declares content the bytes never deliver.
    expectRefused(
      Uint8Array.from([...EBML_MAGIC, 0x94]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // Child element id split across the end of the buffer.
    expectRefused(
      Uint8Array.from([...EBML_MAGIC, 0x83, 0x42]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // Complete child id whose size integer is missing.
    expectRefused(
      Uint8Array.from([...EBML_MAGIC, 0x83, 0x42, 0x86]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // DocType payload truncated below its declared size.
    expectRefused(
      Uint8Array.from([
        ...EBML_MAGIC, 0x8a, // master size covers the children below
        0x42, 0x86, 0x81, 0x01,
        0x42, 0x82, 0x89, 0x61, 0x62, 0x63, // DocType declares 9 bytes, delivers 3
      ]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
    // DocType sits beyond the master header's declared size: never read.
    expectRefused(
      Uint8Array.from([
        ...EBML_MAGIC, 0x80, // empty header
        0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
      ]),
      'INVALID_VIDEO',
      'Unsupported or malformed video data.',
    )
  })

  it('accepts a matroska header using a multi-byte master size integer', () => {
    const docType = Buffer.from('matroska', 'ascii')
    const child = Buffer.concat([Buffer.from([0x42, 0x82, 0x80 | docType.byteLength]), docType])
    // Two-byte data-size vint: marker 0x40 carries the length in the low bits.
    const master = Buffer.concat([EBML_MAGIC, Buffer.from([0x40, child.byteLength]), child])
    expect(detectVideo(new Uint8Array(master))).toBe('video/x-matroska')
  })
})
