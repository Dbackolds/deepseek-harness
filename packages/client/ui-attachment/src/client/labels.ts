import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { AttachmentRailLabels } from '../AttachmentRail.tsx'
import type { DropOverlayLabels } from '../DropOverlay.tsx'
import type { ImageLightboxLabels } from '../ImageLightbox.tsx'
import type { MessageImageLabels } from '../MessageImage.tsx'
import type { MessageVideoLabels } from '../MessageVideo.tsx'

/**
 * Resolve original-image lightbox strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated lightbox labels.
 */
export function lightboxLabels(t: TranslateNS<'conversation'>): ImageLightboxLabels {
  return { dialog: t('image.preview'), close: t('image.closePreview') }
}

/**
 * Resolve historical message-image strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated message-image labels.
 */
export function messageImageLabels(t: TranslateNS<'conversation'>): MessageImageLabels {
  return {
    image: t('image.label'),
    open: t('image.openOriginal'),
    openNamed: label => t('image.openOriginalLabel', { label }),
    loading: t('image.loading'),
    loadFailed: t('image.loadFailed'),
    lightbox: lightboxLabels(t),
  }
}

/**
 * Resolve historical message-video strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated message-video labels.
 */
export function messageVideoLabels(t: TranslateNS<'conversation'>): MessageVideoLabels {
  return {
    video: t('video.label'),
    loading: t('video.loading'),
    loadFailed: t('video.loadFailed'),
  }
}

/**
 * Resolve the document-level drop invitation and its optional limits lines.
 * @param t - conversation namespace translator.
 * @param accepting - whether the composer can accept dropped files.
 * @param limits - optional translated image count and size values.
 * @param videoLimits - optional translated video count and size values.
 * @returns translated drop-overlay labels.
 */
export function dropOverlayLabels(
  t: TranslateNS<'conversation'>,
  accepting: boolean,
  limits?: { readonly count: number; readonly size: string },
  videoLimits?: { readonly count: number; readonly size: string },
): DropOverlayLabels {
  if (!accepting) return { title: t('image.dropBlocked') }
  // Both kinds' limits stack into the desc when both are projected; a video
  // line alone stands on its own.
  const lines = [
    limits === undefined ? undefined : t('image.dropDesc', limits),
    videoLimits === undefined ? undefined : t('video.dropDesc', videoLimits),
  ].filter((line): line is string => line !== undefined)
  return {
    title: t('image.dropTitle'),
    desc: lines.length === 0 ? undefined : lines.join(' · '),
  }
}

/**
 * Resolve draft-image rail strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated attachment-rail labels.
 */
export function attachmentRailLabels(t: TranslateNS<'conversation'>): AttachmentRailLabels {
  return {
    group: t('image.pending'),
    open: t('image.openOriginal'),
    scrollLeft: t('image.scrollLeft'),
    scrollRight: t('image.scrollRight'),
  }
}

/**
 * Resolve draft-video rail strings from the conversation namespace.
 * @param t - conversation namespace translator.
 * @returns translated attachment-rail labels.
 */
export function videoRailLabels(t: TranslateNS<'conversation'>): AttachmentRailLabels {
  return {
    group: t('video.pending'),
    // The video card plays inline; no open gesture exists, so the tooltip
    // names the label instead of promising a preview.
    open: t('video.label'),
    scrollLeft: t('video.scrollLeft'),
    scrollRight: t('video.scrollRight'),
  }
}
