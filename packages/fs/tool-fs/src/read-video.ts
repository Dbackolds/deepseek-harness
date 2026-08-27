/**
 * The model-facing `read_video` tool commits an MP4/MKV/MOV file.
 *
 * The route gate mirrors `read_image`: a video-reading tool is useful only
 * when the exact calling route can inspect its result, so unknown capability
 * refuses instead of relying on an adapter failure after filesystem and
 * attachment work.
 * @module @deepseek-ai/dsh-tool-fs/src/read-video
 */

import { basename, extname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentError, AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { VideoAttachmentRef, VideoMediaType } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import { assertMediaCapableRoute, resolveRegularReadTarget } from './read-target.ts'

/** Extensions `read_video` accepts; container-header sniffing at the attachment service stays authoritative. */
const VIDEO_EXTENSIONS: Readonly<Record<string, VideoMediaType>> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
}

const VIDEO_VALUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: true,
  properties: {
    attachmentId: { type: 'string', required: true },
    mediaType: { type: 'string', enum: ['video/mp4', 'video/x-matroska', 'video/quicktime'], required: true },
    bytes: { type: 'integer', required: true },
    name: { type: 'string' },
  },
} as const

/** The structured outcome declared by the `read_video` output schema. */
export interface VideoReadValue {
  path: string
  video: {
    attachmentId: string
    mediaType: VideoMediaType
    bytes: number
    name?: string
  }
}

/**
 * Map a model-supplied path to its declared video media type by extension.
 * @param filePath - the raw `file_path` argument (not yet resolved).
 * @returns the declared media type, or undefined when the path does not claim a video.
 */
export function videoMediaTypeForPath(filePath: string): VideoMediaType | undefined {
  return VIDEO_EXTENSIONS[extname(filePath).toLowerCase()]
}

/**
 * Enforce the strict video-capability gate for the calling route: the exact
 * resolved route must declare `video` input explicitly.
 * @param ctx - the plugin context used to resolve the optional `llm` service.
 * @param exec - the tool-execution context supplying the calling agent.
 * @param requestedPath - the raw, not-yet-resolved path rendered in refusal messages.
 */
export function assertVideoCapableRoute(ctx: Context, exec: ToolExecution, requestedPath: string): Promise<void> {
  return assertMediaCapableRoute(ctx, exec, requestedPath, 'video')
}

/**
 * Re-brand a structured video outcome into the durable attachment reference a
 * `VideoBlock` carries.
 * @param video - the video metadata from the output schema.
 * @returns the branded attachment reference.
 */
export function videoRefFromValue(video: VideoReadValue['video']): VideoAttachmentRef {
  return {
    attachmentId: AttachmentId(video.attachmentId),
    mediaType: video.mediaType,
    bytes: video.bytes,
    ...video.name === undefined ? {} : { name: video.name },
  }
}

/**
 * Format a video read as the model-facing envelope beside its video block.
 * @param displayPath - the backend-resolved path rendered in the envelope's `<path>` element.
 * @param video - the video metadata to summarize.
 * @returns the model-facing envelope; the video itself rides the adjacent video block.
 */
export function formatVideoReadOutput(displayPath: string, video: VideoReadValue['video']): string {
  return `<path>${displayPath}</path>
<type>video</type>
<content>
${video.mediaType} video, ${video.bytes} bytes
</content>`
}

/**
 * Project one structured video read into its model-facing envelope and video.
 * @param value - the video-read outcome.
 * @returns the two content blocks used by native and nested dispatches.
 */
function videoReadContent(value: VideoReadValue): ContentBlock[] {
  return [
    { type: 'text', text: formatVideoReadOutput(value.path, value.video) },
    { type: 'video', attachment: videoRefFromValue(value.video) },
  ]
}

/**
 * Register the `read_video` tool into the given context. The composing plugin
 * owns the attachments gate: `src/index.ts` calls this inside
 * `ctx.inject(['attachments'], …)` so the tool exists only while a durable
 * store is mounted. Execution still re-checks `ctx.get('attachments')` for
 * direct callers and gates on the calling route's declared video input.
 * @param ctx - the registration scope; execution uses its `fs` service plus
 *   the optional `attachments`/`llm` services.
 */
export function applyReadVideoTool(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'read_video',
    description: 'Read an MP4/MKV/MOV video file and return the video itself. '
      + 'Harness validates the container and size before the next model request, so use this tool directly instead of installing media libraries merely to inspect a video. '
      + 'Independent files may be read concurrently in small batches. Requires the current model to accept video input.',
    parameters: {
      file_path: { type: 'string', required: true, description: 'Path to the video file, resolved by the filesystem backend.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          video: VIDEO_VALUE_SCHEMA,
        },
      },
      render: (_args, value) => videoReadContent(value),
    },
    // Content-addressed attachment writes are idempotent, so concurrent reads
    // of the same file cannot conflict.
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (args.file_path.trim().length === 0) throw new Error('file_path must be a non-empty string')

      // Every gate runs before any filesystem I/O so a refusal never leaks
      // partial reads or attachment writes.
      const mediaType = videoMediaTypeForPath(args.file_path)
      if (mediaType === undefined) {
        throw new Error(`cannot read "${args.file_path}": read_video only accepts MP4/MKV/MOV paths`)
      }
      const attachments = ctx.get('attachments')
      if (attachments === undefined) {
        throw new Error(`cannot read "${args.file_path}" as a video: no attachment service is mounted`)
      }
      if (!attachments.videoLimits.mediaTypes.includes(mediaType)) {
        throw new Error(`cannot read "${args.file_path}": ${mediaType} videos are not accepted by this deployment`)
      }
      await assertVideoCapableRoute(ctx, exec, args.file_path)

      const { target, info } = await resolveRegularReadTarget(ctx, exec, args.file_path)

      // The tool result is one message carrying one video, so the per-message
      // aggregate bound applies beside the per-video bound.
      const byteCap = Math.min(attachments.videoLimits.maxVideoBytes, attachments.videoLimits.maxMessageVideoBytes)
      const data = await ctx.fs.readBytes(target, exec.signal, byteCap)
      // Persist before returning: the video block must reference a durably
      // committed object by the time the tool/result event is appended.
      let ref: VideoAttachmentRef
      try {
        ref = await attachments.saveVideo({ data, mediaType, name: basename(target.displayPath) })
      } catch (error: unknown) {
        if (!(error instanceof AttachmentError)) throw error
        // Admission refusals stay recoverable tool errors: an unaccepted video
        // must never enter durable history, where it would ride every later
        // model request past provider-side container rejections.
        if (error.code === 'VIDEO_TOO_LARGE') {
          throw new Error(
            `cannot read "${target.displayPath}": the video cannot be stored within the deployment's byte limits; compress the video and read the smaller file`,
            { cause: error },
          )
        }
        if (error.code !== 'INVALID_VIDEO') throw error
        const extension = extname(target.displayPath).toLowerCase()
        throw new Error(
          `cannot read "${target.displayPath}": the ${extension} extension declares ${mediaType}, but the bytes are not a supported MP4/MKV/MOV video container; rename the file to match its actual container if it is MP4/MKV/MOV, or convert it to one of those containers`,
          { cause: error },
        )
      }
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      const value: VideoReadValue = {
        path: target.displayPath,
        video: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          ...ref.name === undefined ? {} : { name: ref.name },
        },
      }
      return value
    },
    // Pure display: a generic card in the read family with a follow-along
    // location on the video file.
    presentCall(args): GenericCallView {
      return {
        card: 'generic',
        title: `Read video ${args.file_path}`,
        kind: 'read',
        locations: [{ path: args.file_path }],
      }
    },
  }))
}
