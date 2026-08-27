/** Synthetic video container headers for the local backend tests — no real media files. */

import { Buffer } from 'node:buffer'

/**
 * Build a minimal ISO-BMFF `ftyp` box: size, `ftyp`, major brand, minor
 * version, and one compatible brand.
 */
export function ftypBox(brand: string): Uint8Array {
  const box = Buffer.alloc(20)
  box.writeUInt32BE(box.byteLength, 0)
  box.write('ftyp', 4, 'ascii')
  box.write(brand, 8, 'ascii')
  box.writeUInt32BE(0, 12)
  box.write(brand, 16, 'ascii')
  return new Uint8Array(box)
}

/** Minimal MP4 source: the common `isom` major brand. */
export const MP4 = ftypBox('isom')
/** Minimal QuickTime source: the `qt  ` major brand. */
export const MOV = ftypBox('qt  ')

/** Build a minimal EBML header declaring one doc type. */
export function ebmlHeader(docType: string): Uint8Array {
  const element = (id: [number, number], payload: Buffer): Buffer => Buffer.concat([
    Buffer.from(id),
    // Data-size vints carry the marker bit: one byte covers sizes below 128.
    Buffer.from([0x80 | payload.byteLength]),
    payload,
  ])
  const content = Buffer.concat([
    element([0x42, 0x86], Buffer.from([1])), // EBMLVersion
    element([0x42, 0xf7], Buffer.from([1])), // EBMLReadVersion
    element([0x42, 0x82], Buffer.from(docType, 'ascii')), // DocType
  ])
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80 | content.byteLength]),
    content,
  ]))
}

/** Minimal Matroska source. */
export const MKV = ebmlHeader('matroska')
/** Minimal WebM source: structurally valid EBML, rejected by admission. */
export const WEBM = ebmlHeader('webm')
