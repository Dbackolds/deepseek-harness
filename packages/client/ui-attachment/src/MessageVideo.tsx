import { useCallback, useEffect, useState } from 'react'
import type { VideoAttachmentRef } from '@deepseek-ai/dsh-attachment'
import css from './MessageVideo.module.css'

/** Loads a session-authorized durable video URL. */
export type VideoLoader = (attachment: VideoAttachmentRef) => Promise<string>

/** Message-video strings the owner resolves from its own locale namespace. */
export interface MessageVideoLabels {
  /** Fallback display name for an unnamed video. */
  video: string
  /** Loading placeholder shown until bytes resolve. */
  loading: string
  /** Retry-control label shown when the load fails. */
  loadFailed: string
}

/**
 * History renderer for one durable video: an inline `<video controls>` player
 * (no lightbox in v1) with retryable loading. The player caps at 320px wide
 * and keeps its natural aspect through the element's intrinsic sizing.
 *
 * @param props.attachment - the durable video reference to load and play.
 * @param props.load - session-authorized URL loader.
 * @param props.labels - resolved strings (loading, retry).
 * @returns the bounded inline player, or the retry control on failure.
 */
export function MessageVideo({ attachment, load, labels }: {
  attachment: VideoAttachmentRef
  load: VideoLoader
  labels: MessageVideoLabels
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  // Retry re-arms the one load effect below, so every attempt — first load or
  // retry — runs under the same liveness guard and the same reset.
  const [attempt, setAttempt] = useState(0)
  const request = useCallback(() => { setAttempt(a => a + 1) }, [])

  useEffect(() => {
    let live = true
    setError(false)
    setSrc(null)
    void load(attachment).then((url) => { if (live) setSrc(url) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [attachment, load, attempt])

  if (error) return <button type="button" className={css.error} onClick={request}>{labels.loadFailed}</button>
  return (
    <div className={css.player} aria-label={attachment.name ?? labels.video}>
      {src === null
        ? <span className={css.loading}>{labels.loading}</span>
        : <video src={src} controls preload="metadata" aria-label={attachment.name ?? labels.video} />}
    </div>
  )
}

/** Wrapping video group shared by user and assistant history. */
export function VideoGallery({ videos, load, align, labels }: {
  videos: readonly { attachment: VideoAttachmentRef }[]
  load: VideoLoader
  align: 'start' | 'end'
  labels: MessageVideoLabels
}) {
  if (videos.length === 0) return null
  return (
    <div className={css.gallery} data-align={align}>
      {videos.map((video, index) => (
        <MessageVideo key={`${video.attachment.attachmentId}:${index}`} {...video} load={load} labels={labels} />
      ))}
    </div>
  )
}
