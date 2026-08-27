/** Raw request versions for stored videos: exact verified bytes, base64-encoded. */

import { Buffer } from 'node:buffer'
import type { RequestVideoAttachment, VideoAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { readVideoFile } from './store.ts'

/**
 * Read one stored video, verify it, and encode its exact bytes for a model
 * request. No transcode, probe, or cache: the `raw-v1` version is a pure
 * passthrough whose base64 form matches the upstream `video_url` payload.
 * @param root - absolute `DSH_HOME/attachments/v1` root.
 * @param ref - durable reference recorded in the session log.
 * @param signal - optional cancellation for the filesystem read and verification.
 * @returns base64 request bytes beside the verified reference.
 * @throws the signal reason when aborted, or an AttachmentError when verification fails.
 */
export async function readRequestVideoFile(
  root: string,
  ref: VideoAttachmentRef,
  signal?: AbortSignal,
): Promise<RequestVideoAttachment> {
  const stored = await readVideoFile(root, ref, signal)
  return {
    attachment: stored.ref,
    data: Buffer.from(stored.data.buffer, stored.data.byteOffset, stored.data.byteLength).toString('base64'),
    mediaType: stored.ref.mediaType,
    bytes: stored.data.byteLength,
    version: 'raw-v1',
  }
}
