/** Durable attachment storage seam (`ctx.attachments`). @module @deepseek-ai/dsh-attachment */

import { Context, Service } from '@deepseek-ai/cordis'
import { AttachmentError } from './error.ts'
import type {
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestPolicy,
  RequestImageAttachment,
  RequestVideoAttachment,
  SaveImageAttachment,
  SaveVideoAttachment,
  StoredImageAttachment,
  StoredVideoAttachment,
  VideoAttachmentLimits,
  VideoAttachmentRef,
  VideoMediaType,
} from './types.ts'

export { AttachmentId, ImageVariantId } from './brand.ts'
export { AttachmentError, isImageAdmissionError, isVideoAdmissionError } from './error.ts'
export type { AttachmentErrorCode, ImageAdmissionErrorCode, VideoAdmissionErrorCode } from './error.ts'
export { admitEncodedImages, admitEncodedVideos, admitPromptContent } from './admission.ts'
export { requestImageDimensions } from './request-projection.ts'
export type {
  AttachmentId as AttachmentIdType,
  AdmittedPromptContentPart,
  EncodedImageAttachment,
  EncodedVideoAttachment,
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestPolicy,
  ImageMediaType,
  PromptContentPart,
  RequestImageAttachment,
  RequestVideoAttachment,
  SaveImageAttachment,
  SaveVideoAttachment,
  StoredImageAttachment,
  StoredVideoAttachment,
  VideoAttachmentLimits,
  VideoAttachmentRef,
  VideoMediaType,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    attachments: AttachmentStore
  }
}

/** Immutable binary attachment service. Implementations validate bytes before publishing a reference. */
export abstract class AttachmentStore extends Service {
  constructor(ctx: Context) {
    super(ctx, 'attachments')
  }

  /** Deployment-resolved image policy used by authoritative and fast-path validation. */
  abstract readonly imageLimits: ImageAttachmentLimits

  /**
   * Validate one image without persisting it.
   * Batch callers validate every member before saving any member.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns completion after the encoded raster has been fully decoded.
   */
  abstract validateImage(input: SaveImageAttachment): Promise<void>

  /**
   * Validate one ordered image batch before committing any member.
   * Validation failures start no writes; storage failures return no partial
   * references, although already published content-addressed objects may stay
   * unreachable until a future retention policy collects them.
   * @param inputs - encoded images in their owning message order.
   * @returns durable references in the exact input order.
   */
  protected validateImageBatch(inputs: readonly SaveImageAttachment[]): void {
    const { maxImagesPerMessage, maxMessageImageBytes, mediaTypes } = this.imageLimits
    if (inputs.length > maxImagesPerMessage) {
      throw new AttachmentError('Image batch exceeds the configured image-count limit.', 'TOO_MANY_IMAGES')
    }
    const totalBytes = inputs.reduce((sum, input) => sum + input.data.byteLength, 0)
    if (totalBytes > maxMessageImageBytes) {
      throw new AttachmentError('Image batch exceeds the configured aggregate image-byte limit.', 'IMAGES_TOO_LARGE')
    }
    for (const input of inputs) {
      if (!mediaTypes.includes(input.mediaType)) {
        throw new AttachmentError(`Image type ${input.mediaType} is not accepted by this deployment.`, 'UNSUPPORTED_IMAGE_TYPE')
      }
    }
  }

  /**
   * Validate and durably commit one ordered image batch.
   * @param inputs - encoded images in owning-message order.
   * @returns durable normalized attachment references in the same order after every member succeeds.
   */
  async saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]> {
    this.validateImageBatch(inputs)
    for (const input of inputs) await this.validateImage(input)

    const refs: ImageAttachmentRef[] = []
    for (const input of inputs) refs.push(await this.saveImage(input))
    return refs
  }

  /**
   * Validate and durably commit one image before its owning session event is appended.
   * The returned reference describes the persisted normalized image. When
   * normalization reduces the raster, its `originalDimensions` records the
   * orientation-applied input dimensions.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns the durable content-addressed normalized image reference.
   */
  abstract saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>

  /**
   * Read one image and verify that bytes still match the recorded reference.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and normalized attachment reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  abstract readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>

  /**
   * Locate the provider-owned normalized object in the harness host filesystem.
   * @param ref - durable normalized attachment reference.
   * @returns an absolute host path, or undefined when this backend is not host-file-backed.
   * @throws an AttachmentError when the durable reference is invalid.
   */
  imageHostPath(ref: ImageAttachmentRef): string | undefined {
    void ref
    return undefined
  }

  /**
   * Generate or read one deterministic model-request version from the stored normalized image.
   * @param ref - durable provider-independent normalized attachment reference.
   * @param policy - exact route pixel budget and encoded-byte target; a target no ladder quality meets yields the smallest ladder output.
   * @param signal - optional cancellation.
   * @returns request bytes and the cache/upload identity covering every transform input.
   */
  readImageRequest(
    ref: ImageAttachmentRef,
    policy: ImageRequestPolicy,
    signal?: AbortSignal,
  ): Promise<RequestImageAttachment> {
    signal?.throwIfAborted()
    void ref
    void policy
    return Promise.reject(new AttachmentError(
      'The mounted attachment provider cannot derive model-request images.',
      'ATTACHMENT_PROJECTION_UNSUPPORTED',
    ))
  }

  /**
   * Deployment-resolved video policy used by authoritative and fast-path
   * validation. The default is the zero-admission policy: backends without
   * video support refuse every non-empty video batch as caller-correctable.
   * Video-capable implementations override this with their resolved limits.
   */
  readonly videoLimits: VideoAttachmentLimits = Object.freeze({
    maxVideoBytes: 0,
    maxVideosPerMessage: 0,
    maxMessageVideoBytes: 0,
    mediaTypes: Object.freeze([] as readonly VideoMediaType[]),
  })

  /**
   * Validate one video without persisting it.
   * Batch callers validate every member before saving any member.
   * The default refuses video on image-only deployments; video-capable
   * implementations override this with container-header verification.
   * @param input - submitted bytes, declared media type, and optional display name.
   * @returns completion after the container header has been verified.
   */
  validateVideo(input: SaveVideoAttachment): Promise<void> {
    void input
    return Promise.reject(new AttachmentError(
      'Video attachments are not accepted by this deployment.',
      'UNSUPPORTED_VIDEO_TYPE',
    ))
  }

  /**
   * Validate one ordered video batch before committing any member.
   * Validation failures start no writes; storage failures return no partial
   * references, although already published content-addressed objects may stay
   * unreachable until a future retention policy collects them.
   * @param inputs - submitted videos in their owning message order.
   */
  protected validateVideoBatch(inputs: readonly SaveVideoAttachment[]): void {
    const { maxVideosPerMessage, maxMessageVideoBytes, mediaTypes } = this.videoLimits
    if (inputs.length > maxVideosPerMessage) {
      throw new AttachmentError('Video batch exceeds the configured video-count limit.', 'TOO_MANY_VIDEOS')
    }
    const totalBytes = inputs.reduce((sum, input) => sum + input.data.byteLength, 0)
    if (totalBytes > maxMessageVideoBytes) {
      throw new AttachmentError('Video batch exceeds the configured aggregate video-byte limit.', 'VIDEOS_TOO_LARGE')
    }
    for (const input of inputs) {
      if (!mediaTypes.includes(input.mediaType)) {
        throw new AttachmentError(`Video type ${input.mediaType} is not accepted by this deployment.`, 'UNSUPPORTED_VIDEO_TYPE')
      }
    }
  }

  /**
   * Validate and durably commit one ordered video batch.
   * @param inputs - submitted videos in owning-message order.
   * @returns durable attachment references in the same order after every member succeeds.
   */
  async saveVideos(inputs: readonly SaveVideoAttachment[]): Promise<readonly VideoAttachmentRef[]> {
    this.validateVideoBatch(inputs)
    for (const input of inputs) await this.validateVideo(input)

    const refs: VideoAttachmentRef[] = []
    for (const input of inputs) refs.push(await this.saveVideo(input))
    return refs
  }

  /**
   * Validate and durably commit one video before its owning session event is appended.
   * The returned reference describes the persisted bytes exactly: version one
   * stores submitted video untransformed. The default refuses video on
   * image-only deployments; video-capable implementations override this.
   * @param input - submitted bytes, declared media type, and optional display name.
   * @returns the durable content-addressed video reference.
   */
  saveVideo(_input: SaveVideoAttachment): Promise<VideoAttachmentRef> {
    return Promise.reject(new AttachmentError(
      'Video attachments are not accepted by this deployment.',
      'UNSUPPORTED_VIDEO_TYPE',
    ))
  }

  /**
   * Read one video and verify that bytes still match the recorded reference.
   * The default refuses video on image-only deployments; video-capable
   * implementations override this with digest verification.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and attachment reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  readVideo(ref: VideoAttachmentRef, signal?: AbortSignal): Promise<StoredVideoAttachment> {
    signal?.throwIfAborted()
    void ref
    return Promise.reject(new AttachmentError(
      'Video attachments are not accepted by this deployment.',
      'UNSUPPORTED_VIDEO_TYPE',
    ))
  }

  /**
   * Read the deterministic model-request version of one stored video: the
   * exact verified bytes, base64-encoded.
   * @param ref - durable video attachment reference.
   * @param signal - optional cancellation.
   * @returns base64 request bytes and the verified reference.
   */
  readVideoRequest(
    ref: VideoAttachmentRef,
    signal?: AbortSignal,
  ): Promise<RequestVideoAttachment> {
    signal?.throwIfAborted()
    void ref
    return Promise.reject(new AttachmentError(
      'The mounted attachment provider cannot derive model-request videos.',
      'ATTACHMENT_PROJECTION_UNSUPPORTED',
    ))
  }

}

export default AttachmentStore
