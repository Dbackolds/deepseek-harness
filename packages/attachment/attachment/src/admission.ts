/** Wire-form admission of base64-encoded image, video, and file uploads. @module @deepseek-ai/dsh-attachment/admission */

import { Buffer } from 'node:buffer'
import { AttachmentError } from './error.ts'
import type { AttachmentStore } from './index.ts'
import type {
  AdmittedPromptContentPart,
  AttachmentAdmissionPart,
  EncodedFileAttachment,
  EncodedImageAttachment,
  EncodedVideoAttachment,
  FileAttachmentRef,
  ImageAttachmentRef,
  PromptContentPart,
  SaveImageAttachment,
  SaveVideoAttachment,
  VideoAttachmentRef,
} from './types.ts'

/** Decode one upload payload while rejecting non-canonical base64 forms. */
function decodeCanonicalBase64(
  data: string,
  empty: 'reject' | 'accept',
  code: 'INVALID_IMAGE_BASE64' | 'INVALID_FILE_BASE64' | 'INVALID_VIDEO',
): Uint8Array {
  const decoded = Buffer.from(data, 'base64')
  if ((data.length === 0 && empty === 'reject') || decoded.toString('base64') !== data) {
    throw new AttachmentError(
      code === 'INVALID_IMAGE_BASE64'
        ? 'Image upload is not canonical base64.'
        : code === 'INVALID_FILE_BASE64'
          ? 'File upload is not canonical base64.'
          : 'Video upload is not canonical base64.',
      code,
    )
  }
  return new Uint8Array(decoded)
}

/** Store input for one decoded image upload. */
function imageInput(image: EncodedImageAttachment): SaveImageAttachment {
  return {
    data: decodeCanonicalBase64(image.data, 'reject', 'INVALID_IMAGE_BASE64'),
    mediaType: image.mediaType,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

/** Store input for one decoded video upload. */
function videoInput(video: EncodedVideoAttachment): SaveVideoAttachment {
  return {
    data: decodeCanonicalBase64(video.data, 'reject', 'INVALID_VIDEO'),
    mediaType: video.mediaType,
    ...video.name === undefined ? {} : { name: video.name },
  }
}

/**
 * Admit one wire image batch: enforce canonical base64 on every member, then
 * delegate batch admission — count and aggregate-byte limits, media-type and
 * per-image validation, ordered commit — to {@link AttachmentStore.saveImages}.
 * The shared entry for every RPC endpoint accepting browser uploads.
 * @param attachments - the deployment attachment store owning batch policy.
 * @param images - base64-encoded uploads in caller order.
 * @returns durable references in the same order as `images`.
 * @throws AttachmentError on a non-canonical payload or a refused batch.
 */
export async function admitEncodedImages(
  attachments: AttachmentStore,
  images: readonly EncodedImageAttachment[],
): Promise<readonly ImageAttachmentRef[]> {
  return attachments.saveImages(images.map(imageInput))
}

/**
 * Admit one wire video batch: enforce canonical base64 on every member, then
 * delegate batch admission — count and aggregate-byte limits, media-type and
 * container validation, ordered commit — to {@link AttachmentStore.saveVideos}.
 * The shared entry for every RPC endpoint accepting browser video uploads.
 * @param attachments - the deployment attachment store owning batch policy.
 * @param videos - base64-encoded uploads in caller order.
 * @returns durable references in the same order as `videos`.
 * @throws AttachmentError on a non-canonical payload or a refused batch.
 */
export async function admitEncodedVideos(
  attachments: AttachmentStore,
  videos: readonly EncodedVideoAttachment[],
): Promise<readonly VideoAttachmentRef[]> {
  return attachments.saveVideos(videos.map(videoInput))
}

/**
 * Admit one wire file upload: enforce canonical base64 (an empty file is a
 * valid zero-byte payload), then delegate verbatim commit to
 * {@link AttachmentStore.saveFile}. The shared entry for every RPC endpoint
 * accepting browser file uploads.
 * @param attachments - the deployment attachment store.
 * @param file - base64-encoded upload and optional display name.
 * @returns the durable content-addressed file reference.
 * @throws AttachmentError on a non-canonical payload or a storage failure.
 */
export async function admitEncodedFile(
  attachments: AttachmentStore,
  file: EncodedFileAttachment,
): Promise<FileAttachmentRef> {
  return attachments.saveFile({
    data: decodeCanonicalBase64(file.data, 'accept', 'INVALID_FILE_BASE64'),
    ...file.name === undefined ? {} : { name: file.name },
  })
}

/**
 * Admit one browser prompt and replace each uploaded image or video with its durable reference.
 * Durable file references pass through unchanged. Text-only prompts do not access the attachment store.
 * @param attachments - the deployment attachment store owning batch policy.
 * @param content - prompt parts in message order after file receipt resolution.
 * @returns admitted prompt parts in the same order as `content`.
 * @throws AttachmentError when an image or video batch is refused.
 */
export async function admitPromptContent(
  attachments: AttachmentStore,
  content: readonly AttachmentAdmissionPart[],
): Promise<AdmittedPromptContentPart[]> {
  if (content.every(part => part.type === 'text' || part.type === 'file')) {
    return content.map(part => part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'file', attachment: part.attachment })
  }
  const images = content.filter((part): part is Extract<PromptContentPart, { type: 'image' }> => part.type === 'image')
  const videos = content.filter((part): part is Extract<PromptContentPart, { type: 'video' }> => part.type === 'video')
  const [imageRefs, videoRefs] = await Promise.all([
    images.length > 0 ? admitEncodedImages(attachments, images) : [],
    videos.length > 0 ? admitEncodedVideos(attachments, videos) : [],
  ])
  let nextImage = 0
  let nextVideo = 0
  return content.map((part): AdmittedPromptContentPart => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    if (part.type === 'file') return { type: 'file', attachment: part.attachment }
    if (part.type === 'image') return { type: 'image', attachment: imageRefs[nextImage++] as ImageAttachmentRef }
    return { type: 'video', attachment: videoRefs[nextVideo++] as VideoAttachmentRef }
  })
}
