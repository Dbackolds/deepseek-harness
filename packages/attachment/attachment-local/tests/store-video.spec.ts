import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { VideoAttachmentLimits } from '@deepseek-ai/dsh-attachment'
import { commitPreparedVideoFile, prepareVideoFile, readVideoFile, saveVideoFile, validateVideoFile } from '../src/store.ts'
import { MKV, MP4, MOV } from './video-fixtures.ts'

const LIMITS: VideoAttachmentLimits = {
  maxVideoBytes: 1024,
  maxVideosPerMessage: 2,
  maxMessageVideoBytes: 2048,
  mediaTypes: ['video/mp4', 'video/x-matroska', 'video/quicktime'],
}

const roots: string[] = []

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'dsh-attachment-video-'))
  roots.push(value)
  return join(value, 'attachments', 'v1')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('local video store', () => {
  it('publishes one private content-addressed object and deduplicates equal bytes', async () => {
    const storageRoot = await root()
    const first = await saveVideoFile(storageRoot, {
      data: MP4, mediaType: 'video/mp4', name: '/private/tmp/clip.mp4',
    }, LIMITS)
    const second = await saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS)
    const sha256 = createHash('sha256').update(MP4).digest('hex')
    const object = join(storageRoot, 'objects', sha256.slice(0, 2), sha256)

    expect(first).toEqual({
      attachmentId: `sha256:${sha256}`,
      mediaType: 'video/mp4',
      bytes: MP4.byteLength,
      name: 'clip.mp4',
    })
    expect(second.attachmentId).toBe(first.attachmentId)
    expect(new Uint8Array(await readFile(object))).toEqual(MP4)
    await expect(readVideoFile(storageRoot, first)).resolves.toEqual({ ref: first, data: MP4 })
  })

  it('stores every accepted container untransformed and reads it back verified', async () => {
    const storageRoot = await root()
    const mov = await saveVideoFile(storageRoot, { data: MOV, mediaType: 'video/quicktime' }, LIMITS)
    const mkv = await saveVideoFile(storageRoot, { data: MKV, mediaType: 'video/x-matroska' }, LIMITS)

    expect(mov.mediaType).toBe('video/quicktime')
    expect(mkv.mediaType).toBe('video/x-matroska')
    expect(mkv.bytes).toBe(MKV.byteLength)
    await expect(readVideoFile(storageRoot, mov)).resolves.toEqual({ ref: mov, data: MOV })
    await expect(readVideoFile(storageRoot, mkv)).resolves.toEqual({ ref: mkv, data: MKV })
  })

  it('validates without persisting and sanitizes display names', async () => {
    const storageRoot = await root()
    await expect(validateVideoFile({ data: MP4, mediaType: 'video/mp4' }, LIMITS)).resolves.toBeUndefined()
    await expect(validateVideoFile({ data: Uint8Array.of(1, 2, 3), mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'INVALID_VIDEO' })
    const unnamed = await prepareVideoFile({ data: MP4, mediaType: 'video/mp4', name: '\u0000' }, LIMITS)
    expect(unnamed.ref).not.toHaveProperty('name')
    expect(existsSync(storageRoot)).toBe(false)
  })

  it('rejects empty, oversized, mismatched, and malformed sources', async () => {
    const storageRoot = await root()
    await expect(saveVideoFile(storageRoot, { data: new Uint8Array(0), mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'INVALID_VIDEO' })
    await expect(saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, { ...LIMITS, maxVideoBytes: 1 }))
      .rejects.toMatchObject({ code: 'VIDEO_TOO_LARGE' })
    await expect(saveVideoFile(storageRoot, { data: MKV, mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'INVALID_VIDEO' })
    await expect(saveVideoFile(storageRoot, { data: Uint8Array.of(1, 2, 3), mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'INVALID_VIDEO' })
  })

  it('forwards read cancellation and preserves its reason', async () => {
    const storageRoot = await root()
    const ref = await saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS)
    const controller = new AbortController()
    await expect(readVideoFile(storageRoot, ref, controller.signal)).resolves.toEqual({ ref, data: MP4 })

    const cancellation = new Error('video read cancelled')
    controller.abort(cancellation)
    await expect(readVideoFile(storageRoot, ref, controller.signal)).rejects.toBe(cancellation)
  })

  it('fails closed when an object is missing, corrupted, unreadable, or addressed by an invalid reference', async () => {
    const storageRoot = await root()
    const ref = await saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS)
    const sha256 = String(ref.attachmentId).slice('sha256:'.length)
    const object = join(storageRoot, 'objects', sha256.slice(0, 2), sha256)

    await writeFile(object, Uint8Array.of(1, 2, 3))
    await expect(readVideoFile(storageRoot, ref)).rejects.toMatchObject({ code: 'ATTACHMENT_CORRUPT' })

    await expect(readVideoFile(storageRoot, { ...ref, attachmentId: 'bad' as never }))
      .rejects.toMatchObject({ code: 'INVALID_ATTACHMENT_REF' })

    const missingRoot = await root()
    await mkdir(missingRoot, { recursive: true })
    await expect(readVideoFile(missingRoot, ref)).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' })

    const unreadableRoot = await root()
    await mkdir(join(unreadableRoot, 'objects', sha256.slice(0, 2), sha256), { recursive: true })
    await expect(readVideoFile(unreadableRoot, ref)).rejects.toMatchObject({ code: 'ATTACHMENT_READ_FAILED' })
  })

  it('rejects reference metadata mismatches on digest-verified bytes', async () => {
    const storageRoot = await root()
    const ref = await saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS)

    await expect(readVideoFile(storageRoot, { ...ref, bytes: ref.bytes + 1 }))
      .rejects.toMatchObject({ code: 'ATTACHMENT_CORRUPT' })
    await expect(readVideoFile(storageRoot, { ...ref, mediaType: 'video/quicktime' }))
      .rejects.toMatchObject({ code: 'ATTACHMENT_CORRUPT' })
  })

  it('rejects conflicting existing objects and accepts verified equal ones', async () => {
    const storageRoot = await root()
    const sha256 = createHash('sha256').update(MP4).digest('hex')
    const target = join(storageRoot, 'objects', sha256.slice(0, 2), sha256)
    await mkdir(join(storageRoot, 'objects', sha256.slice(0, 2)), { recursive: true })
    await writeFile(target, Uint8Array.of(1, 2, 3))
    await expect(saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'ATTACHMENT_CORRUPT' })

    await writeFile(target, MP4)
    await expect(saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS))
      .resolves.toMatchObject({ attachmentId: `sha256:${sha256}` })
  })

  it('maps unexpected publication failures to a stable storage error', async () => {
    const storageRoot = await root()
    const sha256 = createHash('sha256').update(MP4).digest('hex')
    const target = join(storageRoot, 'objects', sha256.slice(0, 2), sha256)
    await mkdir(target, { recursive: true })

    await expect(saveVideoFile(storageRoot, { data: MP4, mediaType: 'video/mp4' }, LIMITS))
      .rejects.toMatchObject({ code: 'ATTACHMENT_WRITE_FAILED' })
  })

  it('rejects prepared bytes that no longer match their content-addressed reference', async () => {
    const storageRoot = await root()
    const prepared = await prepareVideoFile({ data: MP4, mediaType: 'video/mp4' }, LIMITS)

    await expect(commitPreparedVideoFile(storageRoot, {
      ...prepared,
      data: Uint8Array.of(...prepared.data, 0),
    })).rejects.toMatchObject({ code: 'ATTACHMENT_CORRUPT' })
  })
})
