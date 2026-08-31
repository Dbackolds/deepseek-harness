/** Wire-form admission of base64-encoded image and video uploads. @module @deepseek-ai/dsh-attachment/admission */

import { Buffer } from 'node:buffer'
import { AttachmentError } from './error.ts'
import type { AttachmentErrorCode } from './error.ts'
import type { AttachmentStore } from './index.ts'
import type {
  AdmittedPromptContentPart,
  EncodedImageAttachment,
  EncodedVideoAttachment,
  ImageAttachmentRef,
  PromptContentPart,
  SaveImageAttachment,
  SaveVideoAttachment,
  VideoAttachmentRef,
} from './types.ts'

/** Decode one upload payload while rejecting non-canonical base64 forms. */
function decodeBase64(data: string, invalid: string, code: AttachmentErrorCode): Uint8Array {
  const decoded = Buffer.from(data, 'base64')
  if (data.length === 0 || decoded.toString('base64') !== data) {
    throw new AttachmentError(invalid, code)
  }
  return new Uint8Array(decoded)
}

/** Store input for one decoded image upload. */
function imageInput(image: EncodedImageAttachment): SaveImageAttachment {
  return {
    data: decodeBase64(image.data, 'Image upload is not canonical base64.', 'INVALID_IMAGE_BASE64'),
    mediaType: image.mediaType,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

/** Store input for one decoded video upload. */
function videoInput(video: EncodedVideoAttachment): SaveVideoAttachment {
  return {
    data: decodeBase64(video.data, 'Video upload is not canonical base64.', 'INVALID_VIDEO'),
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
 * Admit one browser prompt and replace each uploaded image or video with its durable reference.
 * Text-only prompts do not access the attachment store.
 * @param attachments - the deployment attachment store owning batch policy.
 * @param content - browser prompt parts in message order.
 * @returns admitted prompt parts in the same order as `content`.
 * @throws AttachmentError when an image or video batch is refused.
 */
export async function admitPromptContent(
  attachments: AttachmentStore,
  content: readonly PromptContentPart[],
): Promise<AdmittedPromptContentPart[]> {
  if (content.every(part => part.type === 'text')) {
    return content.map(part => ({ type: 'text', text: part.text }))
  }
  const images = content.filter(part => part.type === 'image')
  const videos = content.filter(part => part.type === 'video')
  const [imageRefs, videoRefs] = await Promise.all([
    images.length > 0 ? admitEncodedImages(attachments, images) : [],
    videos.length > 0 ? admitEncodedVideos(attachments, videos) : [],
  ])
  let nextImage = 0
  let nextVideo = 0
  return content.map((part): AdmittedPromptContentPart => part.type === 'text'
    ? { type: 'text', text: part.text }
    : part.type === 'image'
      ? { type: 'image', attachment: imageRefs[nextImage++] as ImageAttachmentRef }
      : { type: 'video', attachment: videoRefs[nextVideo++] as VideoAttachmentRef })
}
