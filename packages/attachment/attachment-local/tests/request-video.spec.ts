import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import LocalAttachmentStore from '../src/index.ts'
import { readRequestVideoFile } from '../src/request-video.ts'
import { MKV, MP4 } from './video-fixtures.ts'

const homes: string[] = []

async function store(): Promise<LocalAttachmentStore> {
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-request-video-'))
  homes.push(dshHome)
  return new LocalAttachmentStore(new Context(), { dshHome })
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })))
})

describe('local request-video version', () => {
  it('returns the exact stored bytes as canonical base64 with the raw-v1 version', async () => {
    const attachments = await store()
    const mp4 = await attachments.saveVideo({ data: MP4, mediaType: 'video/mp4' })
    const mkv = await attachments.saveVideo({ data: MKV, mediaType: 'video/x-matroska', name: 'clip.mkv' })

    const request = await attachments.readVideoRequest(mp4)
    const second = await readRequestVideoFile(attachments.root, mkv)

    expect(request).toEqual({
      attachment: mp4,
      data: Buffer.from(MP4).toString('base64'),
      mediaType: 'video/mp4',
      bytes: MP4.byteLength,
      version: 'raw-v1',
    })
    expect(new Uint8Array(Buffer.from(request.data, 'base64'))).toEqual(MP4)
    expect(second).toMatchObject({ attachment: mkv, mediaType: 'video/x-matroska', bytes: MKV.byteLength, version: 'raw-v1' })
    expect(new Uint8Array(Buffer.from(second.data, 'base64'))).toEqual(MKV)
  })

  it('preserves read cancellation and verification failures', async () => {
    const attachments = await store()
    const ref = await attachments.saveVideo({ data: MP4, mediaType: 'video/mp4' })
    const cancellation = new Error('request video cancelled')
    const controller = new AbortController()
    controller.abort(cancellation)
    await expect(attachments.readVideoRequest(ref, controller.signal)).rejects.toBe(cancellation)

    const otherHome = await mkdtemp(join(tmpdir(), 'dsh-request-video-missing-'))
    homes.push(otherHome)
    const missing = new LocalAttachmentStore(new Context(), { dshHome: otherHome })
    await expect(missing.readVideoRequest(ref)).rejects.toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' })
  })
})
