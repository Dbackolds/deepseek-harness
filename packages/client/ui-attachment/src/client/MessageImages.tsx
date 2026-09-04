import type { MessageImagesProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { ImageGallery } from '../MessageImage.tsx'
import { VideoGallery } from '../MessageVideo.tsx'
import { messageImageLabels, messageVideoLabels } from './labels.ts'

/** Historical message-image and message-video slot entry. */
export function MessageImages({
  images, loadImage, videos = [], loadVideo, align, compact = false, t,
}: MessageImagesProps) {
  return (
    <>
      <ImageGallery
        images={images}
        load={loadImage}
        align={align}
        compact={compact}
        labels={messageImageLabels(t)}
      />
      {loadVideo !== undefined && videos.length > 0
        ? <VideoGallery videos={videos as never} load={loadVideo as never} align={align} labels={messageVideoLabels(t)} />
        : null}
    </>
  )
}
