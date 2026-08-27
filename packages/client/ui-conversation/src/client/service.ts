/**
 * Scope-addressed conversation send, cancel, and history orchestration.
 *
 * Scope addressing rides the cordis Service tracker: property access through
 * `ctx.conversation` rebinds `this.ctx` to the caller's context, so methods
 * read the session tag with `scopeOf`. Mutable state must remain reachable
 * through one property read; assignment through the tracker proxy and `#`
 * private fields bypass that rebinding.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
// Type-only imports: a plugin-to-plugin value import is a bundle purity
// error, so scope resolution goes through the sessions service (scopeOf
// method) instead of the standalone helper.
import type { ISessions, SessionFace, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SubmitImageAttachment, SubmitOutcome, SubmitVideoAttachment,
} from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {
  ImageAttachmentRef, ImageMediaType, VideoAttachmentRef, VideoMediaType,
} from '@deepseek-ai/dsh-attachment'
import type { ComposerAttachment } from './contract/slots.ts'
import type { QueueAction, QueueItemId } from './contract/queue.ts'
import type { ComposerBlocks } from './input/blocks.ts'
import type { DraftAttachmentId, SessionInputResolver } from './input/contract.ts'
import type { InputSubmitMode } from './contract/composer-submission.ts'

/**
 * The outward conversation face (`ctx.conversation`): the scope-addressed
 * verbs and the input registry other plugins may reach — and exactly what a
 * test fake must supply.
 */
export interface IConversation {
  /** The per-session input machine registry (SessionInputResolver face). */
  readonly input: SessionInputResolver
  /**
   * The per-session composer-block registry: how a plugin the composer
   * cannot import makes a session's input inert with its own reason.
   */
  readonly blocks: ComposerBlocks
  /**
   * Send a prompt into the caller scope's session (queued turn).
   * @param text - prompt text, sent verbatim as one text block.
   * @returns completion; business failures reject (and land in promptError).
   */
  send(text: string): Promise<void>
  /**
   * Rewrite a settled user prompt in this same session and start a new turn
   * from the replacement. Failures also land in promptError.
   * @param atSeq - current-surface `user/message` seq being edited.
   * @param text - replacement text, sent verbatim as one text block.
   * @returns completion; business failures reject.
   */
  rewrite(atSeq: number, text: string): Promise<void>
  /**
   * Apply one text edit, remove, or strict steer operation to a pending queue occurrence.
   * An edit payload is one text block; the host keeps already-admitted non-text blocks.
   * @param itemId - agent-owned inbox occurrence identity.
   * @param action - requested queue operation.
   * @returns completion; converged strict-steer races resolve, while other failures reject.
   */
  updateQueue(itemId: QueueItemId, action: QueueAction): Promise<void>
  /**
   * Cancel the scoped session's in-flight turn while preserving its pending Queue.
   * @returns completion; failures reject as in send.
   */
  cancel(): Promise<void>
  /**
   * Pull one older history page for the scoped session.
   * @returns completion of the page pull.
   */
  loadOlder(): Promise<void>
}

/** Create one browser-only draft descriptor; only its id enters input state. */
function browserDraftAttachment(file: File, kind: 'image' | 'video'): ComposerAttachment {
  return {
    kind,
    id: crypto.randomUUID() as DraftAttachmentId,
    previewUrl: URL.createObjectURL(file),
    file,
  }
}

interface MediaUrlEntry {
  readonly sessionId: SessionId
  readonly generation: number
  readonly pending: Promise<string>
}

/** Unsupported browser-declared image type, localized by the UI boundary. */
export class UnsupportedImageMediaTypeError extends Error {
  /** Browser-declared MIME value, possibly empty. */
  readonly mediaType: string

  /** @param mediaType - Browser-declared MIME value, possibly empty. */
  constructor(mediaType: string) {
    super(`unsupported image media type: ${mediaType || '(empty)'}`)
    this.name = 'UnsupportedImageMediaTypeError'
    this.mediaType = mediaType
  }
}

/** Unsupported browser-declared video type, localized by the UI boundary. */
export class UnsupportedVideoMediaTypeError extends Error {
  /** Browser-declared MIME value, possibly empty. */
  readonly mediaType: string

  /** @param mediaType - Browser-declared MIME value, possibly empty. */
  constructor(mediaType: string) {
    super(`unsupported video media type: ${mediaType || '(empty)'}`)
    this.name = 'UnsupportedVideoMediaTypeError'
    this.mediaType = mediaType
  }
}

/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
export class ConversationController extends Service implements IConversation {
  /** The per-session input machine registry (SessionInputResolver face). */
  readonly input: SessionInputResolver
  /** The per-session composer-block registry. */
  readonly blocks: ComposerBlocks
  private readonly draftAttachments = new Map<DraftAttachmentId, ComposerAttachment>()
  private readonly mediaUrls = new Map<string, MediaUrlEntry>()
  private readonly mediaGenerations = new Map<SessionId, number>()
  private readonly createdMediaUrls = new Set<string>()
  private disposed = false

  /**
   * @param ctx - owning root context (the plugin apply context; the service
   * registers itself and follows that fiber's lifetime).
   * @param config - carries the SessionInputResolver and composer-block registry
   * constructed by the plugin apply (the same instances the slot inject
   * factories close over).
   */
  constructor(ctx: Context, config: { input: SessionInputResolver; blocks: ComposerBlocks }) {
    super(ctx, 'conversation')
    this.input = config.input
    this.blocks = config.blocks
    ctx.effect(() => () => {
      this.disposed = true
      for (const url of this.createdMediaUrls) revokePreview(url)
      this.createdMediaUrls.clear()
      this.draftAttachments.clear()
      this.mediaUrls.clear()
      this.mediaGenerations.clear()
    }, 'conversation attachment URL cache')
  }

  /**
   * Send a prompt into the scoped session. Business failures also land in the
   * session snapshot's promptError (object-layer state); the rejection here
   * exists for caller choreography (the composer restores the draft on it).
   * @param text - prompt text, sent verbatim as one text block.
   */
  async send(text: string): Promise<void> {
    const session = this.scopedSession('send')
    const result = await session.prompt([{ type: 'text', text }], 'queue')
    if (!result.ok) throw new Error(`conversation.send failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Rewrite a settled user prompt in the scoped session. Business failures
   * also land in the session snapshot's promptError.
   * @param atSeq - current-surface `user/message` seq being edited.
   * @param text - replacement text, sent verbatim as one text block.
   */
  async rewrite(atSeq: number, text: string): Promise<void> {
    const session = this.scopedSession('rewrite')
    const result = await session.rewrite(atSeq, [{ type: 'text', text }])
    if (!result.ok) throw new Error(`conversation.rewrite failed: ${result.error.code}: ${result.error.message}`)
  }

  /**
   * Submit ordered draft images and videos with text through one host admission.
   * @param session - target session.
   * @param text - serialized prompt text.
   * @param imageIds - ordered draft-local image ids.
   * @param videoIds - ordered draft-local video ids.
   * @param mode - queue or steer delivery selected by composer policy.
   * @param signal - optional cancellation for the complete Host admission.
   * @returns the Host admission outcome; local attachment preparation failures reject.
   */
  async sendSession(
    session: SessionFace,
    text: string,
    imageIds: readonly DraftAttachmentId[],
    videoIds: readonly DraftAttachmentId[],
    mode: InputSubmitMode,
    signal?: AbortSignal,
  ): Promise<SubmitOutcome> {
    const attachments = this.draftImages(imageIds)
    if (attachments.length !== imageIds.length) {
      throw new Error('conversation.sendSession: one or more draft images are no longer available')
    }
    const videos = this.draftVideos(videoIds)
    if (videos.length !== videoIds.length) {
      throw new Error('conversation.sendSession: one or more draft videos are no longer available')
    }
    const [uploadedImages, uploadedVideos] = await Promise.all([
      this.serializeImages(attachments.map(attachment => attachment.file)),
      this.serializeVideos(videos.map(video => video.file)),
    ])
    const content = [...uploadedImages, ...uploadedVideos, ...(text === '' ? [] : [{ type: 'text' as const, text }])]
    const result = await session.prompt(content, mode, signal)
    if (!result.ok) return { kind: 'error' }
    this.releaseDraftImages(attachments)
    this.releaseDraftVideos(videos)
    return { kind: 'success' }
  }

  /**
   * Create runtime-only draft images and their object URLs.
   * @param files - browser files to register after MIME validation.
   * @returns ordered draft descriptors.
   */
  createDraftImages(files: readonly File[]): readonly ComposerAttachment[] {
    for (const file of files) imageMediaType(file.type)
    return files.map((file) => {
      const attachment = browserDraftAttachment(file, 'image')
      this.draftAttachments.set(attachment.id, attachment)
      this.createdMediaUrls.add(attachment.previewUrl)
      return attachment
    })
  }

  /**
   * Resolve ordered input-state ids to runtime-owned draft images.
   * @param ids - draft attachment ids.
   * @returns descriptors that remain live, in requested order.
   */
  draftImages(ids: readonly DraftAttachmentId[]): readonly ComposerAttachment[] {
    const attachments: ComposerAttachment[] = []
    for (const id of ids) {
      const attachment = this.draftAttachments.get(id)
      if (attachment !== undefined) attachments.push(attachment)
    }
    return attachments
  }

  /**
   * Serialize ordered draft images to command-submit wire payloads without
   * sending or releasing them (the composer releases only after the command
   * settles successfully).
   * @param imageIds - ordered draft-local attachment ids.
   * @returns base64 payloads in id order.
   */
  async serializeDraftImages(imageIds: readonly DraftAttachmentId[]): Promise<readonly SubmitImageAttachment[]> {
    const attachments = this.draftImages(imageIds)
    if (attachments.length !== imageIds.length) {
      throw new Error('conversation.serializeDraftImages: one or more draft images are no longer available')
    }
    return Promise.all(attachments.map(attachment => this.encodeImage(attachment.file)))
  }

  /**
   * Release one browser-owned draft image and preview URL.
   * @param id - draft attachment id.
   */
  releaseDraftImage(id: DraftAttachmentId): void {
    const attachment = this.draftAttachments.get(id)
    if (attachment === undefined) return
    this.draftAttachments.delete(id)
    this.createdMediaUrls.delete(attachment.previewUrl)
    revokePreview(attachment.previewUrl)
  }

  /**
   * Release a set of browser-owned draft images.
   * @param attachments - descriptors to release.
   */
  releaseDraftImages(attachments: readonly ComposerAttachment[]): void {
    for (const attachment of attachments) this.releaseDraftImage(attachment.id)
  }

  /**
   * Create runtime-only draft videos and their object URLs.
   * @param files - browser files to register after container-type validation.
   * @returns ordered draft descriptors.
   */
  createDraftVideos(files: readonly File[]): readonly ComposerAttachment[] {
    for (const file of files) videoMediaType(file.type)
    return files.map((file) => {
      const attachment = browserDraftAttachment(file, 'video')
      this.draftAttachments.set(attachment.id, attachment)
      this.createdMediaUrls.add(attachment.previewUrl)
      return attachment
    })
  }

  /**
   * Resolve ordered input-state ids to runtime-owned draft videos.
   * @param ids - draft video ids.
   * @returns descriptors that remain live, in requested order.
   */
  draftVideos(ids: readonly DraftAttachmentId[]): readonly ComposerAttachment[] {
    const videos: ComposerAttachment[] = []
    for (const id of ids) {
      const attachment = this.draftAttachments.get(id)
      if (attachment !== undefined) videos.push(attachment)
    }
    return videos
  }

  /**
   * Release one browser-owned draft video and preview URL.
   * @param id - draft video id.
   */
  releaseDraftVideo(id: DraftAttachmentId): void {
    this.releaseDraftImage(id)
  }

  /**
   * Release a set of browser-owned draft videos.
   * @param videos - descriptors to release.
   */
  releaseDraftVideos(videos: readonly ComposerAttachment[]): void {
    for (const video of videos) this.releaseDraftVideo(video.id)
  }

  /**
   * Resolve and cache one session-authorized historical media URL (image or
   * video over one id-keyed cache).
   * @param sessionId - owning session authorization scope.
   * @param attachmentId - durable attachment id.
   * @param op - the failing operation's name for diagnostics.
   * @param load - the session read producing the authorized URL.
   * @returns browser URL valid until its rendered session is released.
   */
  private resolveMediaUrl(
    sessionId: SessionId,
    attachmentId: string,
    op: 'resolveImage' | 'resolveVideo',
    load: () => Promise<string>,
  ): Promise<string> {
    if (this.disposed) return Promise.reject(new Error(`conversation.${op}: service is disposed`))
    const key = `${sessionId}:${attachmentId}`
    const cached = this.mediaUrls.get(key)
    if (cached !== undefined) return cached.pending
    const generation = this.mediaGenerations.get(sessionId) ?? 0
    const pending = load()
      .then((url) => {
        if (this.disposed) throw new Error(`conversation.${op}: service was disposed before loading completed`)
        if ((this.mediaGenerations.get(sessionId) ?? 0) !== generation) {
          throw new Error('historical media scope was released before loading completed')
        }
        this.createdMediaUrls.add(url)
        return url
      })
      .catch((error: unknown) => {
        if (this.mediaUrls.get(key)?.generation === generation) this.mediaUrls.delete(key)
        throw error
      })
    this.mediaUrls.set(key, { sessionId, generation, pending })
    return pending
  }

  private static mediaObjectUrl(bytes: Uint8Array<ArrayBuffer>, mediaType: string): string {
    if (typeof URL.createObjectURL !== 'function') {
      return `data:${mediaType};base64,${bytesToBase64(bytes)}`
    }
    return URL.createObjectURL(new Blob([bytes.buffer], { type: mediaType }))
  }

  /**
   * Resolve and cache one session-authorized historical image URL.
   * @param sessionId - owning session authorization scope.
   * @param attachment - durable image reference.
   * @returns browser URL valid until its rendered session is released.
   */
  resolveImage(sessionId: SessionId, attachment: ImageAttachmentRef): Promise<string> {
    const session = this.requireSessions().binding(sessionId)?.session
    if (session === undefined) {
      return Promise.reject(new Error(`conversation.resolveImage: unknown session "${sessionId}"`))
    }
    return this.resolveMediaUrl(sessionId, String(attachment.attachmentId), 'resolveImage', async () => {
      const result = await session.readAttachment(attachment.attachmentId)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      return ConversationController.mediaObjectUrl(
        Uint8Array.from(result.value.data),
        result.value.attachment.mediaType,
      )
    })
  }

  /**
   * Resolve and cache one session-authorized historical video URL.
   * @param sessionId - owning session authorization scope.
   * @param attachment - durable video reference.
   * @returns browser URL valid until its rendered session is released.
   */
  resolveVideo(sessionId: SessionId, attachment: VideoAttachmentRef): Promise<string> {
    const session = this.requireSessions().binding(sessionId)?.session
    if (session === undefined) {
      return Promise.reject(new Error(`conversation.resolveVideo: unknown session "${sessionId}"`))
    }
    return this.resolveMediaUrl(sessionId, String(attachment.attachmentId), 'resolveVideo', async () => {
      const result = await session.readAttachment(attachment.attachmentId)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      return ConversationController.mediaObjectUrl(
        Uint8Array.from(result.value.data),
        result.value.attachment.mediaType,
      )
    })
  }

  /**
   * Release every historical media URL owned by one rendered session.
   * @param sessionId - rendered session scope.
   */
  releaseSessionImages(sessionId: SessionId): void {
    this.mediaGenerations.set(sessionId, (this.mediaGenerations.get(sessionId) ?? 0) + 1)
    for (const [key, entry] of this.mediaUrls) {
      if (entry.sessionId !== sessionId) continue
      this.mediaUrls.delete(key)
      void entry.pending.then((url) => {
        if (!this.createdMediaUrls.delete(url)) return
        revokePreview(url)
      }, () => {
        // A failed or invalidated load owns no object URL.
      })
    }
  }

  /** Apply one operation to a pending queue occurrence. */
  async updateQueue(itemId: QueueItemId, action: QueueAction): Promise<void> {
    const session = this.scopedSession('updateQueue')
    const result = await session.updateQueue(itemId, action)
    if (!result.ok) {
      if (
        action.kind === 'steer'
        && (result.error.code === 'steer-unavailable' || result.error.code === 'queue-item-not-found')
      ) return
      throw new Error(`conversation.updateQueue failed: ${result.error.code}: ${result.error.message}`)
    }
  }

  /** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
  async cancel(): Promise<void> {
    const session = this.scopedSession('cancel')
    const result = await session.cancel()
    if (!result.ok) throw new Error(`conversation.cancel failed: ${result.error.code}: ${result.error.message}`)
  }

  /** Pull one older history page for the scoped Session. */
  async loadOlder(): Promise<void> {
    await this.scopedSession('loadOlder').loadOlder()
  }

  /** Resolve the caller scope's session face or throw on root contexts. */
  private scopedSession(op: string): SessionFace {
    const id = this.scopeId(op)
    const binding = this.requireSessions().binding(id)
    if (binding === undefined) throw new Error(`conversation.${op}: session "${id}" resolved no binding`)
    return binding.session
  }

  /** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
  private scopeId(op: string): SessionId {
    const id = this.requireSessions().scopeOf(this.ctx)
    if (id === undefined) {
      throw new Error(`conversation.${op} requires a session scope — address one via ctx.sessions.scope(id).conversation`)
    }
    return id
  }

  private requireSessions(): ISessions {
    // Strict ctx.get, not the injection proxy: the scope-addressed pattern
    // reads the service off whatever context the tracker rebound.
    const sessions = this.ctx.get('sessions')
    if (sessions === undefined) throw new Error('conversation: sessions service unavailable')
    return sessions
  }

  /** Convert browser files to canonical base64 prompt parts. */
  private serializeImages(images: readonly File[]): Promise<Parameters<SessionFace['prompt']>[0]> {
    return Promise.all(images.map(async file => ({ type: 'image' as const, ...await this.encodeImage(file) })))
  }

  /** Convert browser video files to canonical base64 prompt parts. */
  private serializeVideos(videos: readonly File[]): Promise<Parameters<SessionFace['prompt']>[0]> {
    return Promise.all(videos.map(async file => ({ type: 'video' as const, ...await this.encodeVideo(file) })))
  }

  /** Canonical base64 wire form of one browser image file. */
  private async encodeImage(file: File): Promise<SubmitImageAttachment> {
    return {
      mediaType: imageMediaType(file.type),
      data: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
      ...(file.name === '' ? {} : { name: file.name }),
    }
  }

  /** Canonical base64 wire form of one browser video file. */
  private async encodeVideo(file: File): Promise<SubmitVideoAttachment> {
    return {
      mediaType: videoMediaType(file.type),
      data: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
      ...(file.name === '' ? {} : { name: file.name }),
    }
  }
}

function imageMediaType(value: string): ImageMediaType {
  switch (value) {
    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
    case 'image/gif':
      return value
    default:
      throw new UnsupportedImageMediaTypeError(value)
  }
}

function videoMediaType(value: string): VideoMediaType {
  switch (value) {
    case 'video/mp4':
    case 'video/x-matroska':
    case 'video/quicktime':
      return value
    default:
      throw new UnsupportedVideoMediaTypeError(value)
  }
}

function bytesToBase64(data: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < data.length; offset += chunk) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

function revokePreview(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
