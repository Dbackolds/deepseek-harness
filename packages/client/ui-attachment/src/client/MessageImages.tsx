import type { MessageImagesProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import { ImageGallery } from '../MessageImage.tsx'
import { VideoGallery } from '../MessageVideo.tsx'
import { messageImageLabels, messageVideoLabels } from './labels.ts'

/** Historical message-image and message-video slot entry. */
export function MessageImages({ images, loadImage, videos, loadVideo, align, t }: MessageImagesProps) {
  return (
    <>
      <ImageGallery images={images} load={loadImage} align={align} labels={messageImageLabels(t)} />
      <VideoGallery videos={videos} load={loadVideo} align={align} labels={messageVideoLabels(t)} />
    </>
  )
}
