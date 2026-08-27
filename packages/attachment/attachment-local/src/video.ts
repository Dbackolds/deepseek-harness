/** Video container inspection: header sniffing at admission and on verified reads. */

import { AttachmentError } from '@deepseek-ai/dsh-attachment'
import type { VideoMediaType } from '@deepseek-ai/dsh-attachment'

/** Minimum ISO-BMFF prefix carrying a size, `ftyp`, and a major brand. */
const FTYP_MIN_BYTES = 12
/** Major brand of QuickTime Movie containers; every other `ftyp` brand is treated as MP4. */
const QUICKTIME_BRAND = 'qt  '
/** EBML element id of the root `EBML` header element. */
const EBML_MAGIC_ID = 0x1a45dfa3
/** EBML element id of the `DocType` child inside the `EBML` header. */
const EBML_DOCTYPE_ID = 0x4282

/** Decode bytes as the ASCII subset used by container brands and EBML doc types. */
function ascii(bytes: Uint8Array): string {
  let value = ''
  for (let index = 0; index < bytes.length; index += 1) {
    /* v8 ignore next -- The loop bound keeps the index inside the array; noUncheckedIndexedAccess still types the access as optional. */
    value += String.fromCharCode(bytes[index] ?? 0)
  }
  return value
}

/** One decoded EBML variable-length integer. */
interface Vint {
  value: number
  length: number
}

/**
 * Read one EBML variable-length integer at an offset. Identifier integers
 * keep every bit; data-size integers drop the marker bit.
 */
function readVint(data: Uint8Array, offset: number, keepMarker: boolean): Vint | undefined {
  const first = data[offset]
  if (first === undefined) return undefined
  let length = 1
  let mask = 0x80
  while (mask !== 0 && (first & mask) === 0) {
    mask >>= 1
    length += 1
  }
  if (mask === 0 || offset + length > data.byteLength) return undefined
  let value = keepMarker ? first : first & (mask - 1)
  for (let index = 1; index < length; index += 1) {
    /* v8 ignore next -- The bounds check above proves every accumulated byte is inside the buffer. */
    value = value * 0x100 + (data[offset + index] ?? 0)
  }
  return { value, length }
}

/**
 * Sniff the `ftyp` major brand of an ISO-BMFF container: `qt  ` is
 * QuickTime, any other brand is treated as MP4.
 */
function detectFtyp(data: Uint8Array): VideoMediaType | undefined {
  if (data.byteLength < FTYP_MIN_BYTES) return undefined
  if (ascii(data.subarray(4, 8)) !== 'ftyp') return undefined
  return ascii(data.subarray(8, 12)) === QUICKTIME_BRAND ? 'video/quicktime' : 'video/mp4'
}

/**
 * Read the EBML `DocType` string, or undefined when the bytes are not a
 * parseable EBML header. The walk stops at the first structurally invalid
 * element, so a truncated or malformed header never yields a doc type.
 */
function ebmlDocType(data: Uint8Array): string | undefined {
  const magic = readVint(data, 0, true)
  if (magic === undefined || magic.value !== EBML_MAGIC_ID) return undefined
  const headerSize = readVint(data, magic.length, false)
  if (headerSize === undefined) return undefined
  let offset = magic.length + headerSize.length
  const end = Math.min(data.byteLength, offset + headerSize.value)
  while (offset < end) {
    const id = readVint(data, offset, true)
    if (id === undefined) return undefined
    offset += id.length
    const size = readVint(data, offset, false)
    if (size === undefined) return undefined
    offset += size.length
    if (id.value === EBML_DOCTYPE_ID) {
      if (offset + size.value > data.byteLength) return undefined
      return ascii(data.subarray(offset, offset + size.value))
    }
    offset += size.value
  }
  return undefined
}

/**
 * Sniff one accepted video container from its leading bytes: the `ftyp`
 * brand of an ISO-BMFF file (QuickTime for `qt  `, otherwise MP4) or an
 * EBML header whose `DocType` is `matroska`. Only the header is inspected;
 * no payload decode, duration, or resolution probing.
 * @param data - complete submitted video bytes.
 * @returns the container media type verified from the header.
 * @throws AttachmentError when the container is not accepted by this deployment or the header is malformed.
 */
export function detectVideo(data: Uint8Array): VideoMediaType {
  const ftyp = detectFtyp(data)
  if (ftyp !== undefined) return ftyp
  const docType = ebmlDocType(data)
  if (docType === 'matroska') return 'video/x-matroska'
  if (docType === 'webm') {
    throw new AttachmentError('WebM video containers are not accepted.', 'UNSUPPORTED_VIDEO_TYPE')
  }
  throw new AttachmentError('Unsupported or malformed video data.', 'INVALID_VIDEO')
}
