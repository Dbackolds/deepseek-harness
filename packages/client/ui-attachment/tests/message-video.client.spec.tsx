// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import { MessageVideo, VideoGallery } from '../src/MessageVideo.tsx'
import type { MessageVideoLabels } from '../src/MessageVideo.tsx'

afterEach(cleanup)

const labels: MessageVideoLabels = {
  video: '视频',
  loading: '视频加载中…',
  loadFailed: '视频加载失败，点击重试',
}

const attachment = {
  attachmentId: AttachmentId(`sha256:${'c'.repeat(64)}`),
  mediaType: 'video/mp4' as const,
  bytes: 2048,
  name: 'clip.mp4',
}

describe('MessageVideo', () => {
  it('loads a session-authorized URL into an inline controls player', async () => {
    const load = vi.fn().mockResolvedValue('blob:history-video')
    const view = render(<MessageVideo attachment={attachment} load={load} labels={labels} />)
    expect(view.getByText('视频加载中…')).toBeTruthy()
    const player = await view.findByLabelText('clip.mp4', { selector: 'div' })
    const video = player.querySelector('video')
    expect(video?.getAttribute('src')).toBe('blob:history-video')
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(video?.getAttribute('preload')).toBe('metadata')
    expect(load).toHaveBeenCalledWith(attachment)
  })

  it('falls back to the video label for an unnamed attachment', async () => {
    const { name: _named, ...unnamed } = attachment
    const load = vi.fn().mockResolvedValue('blob:unnamed-video')
    const view = render(<MessageVideo attachment={unnamed} load={load} labels={labels} />)
    const player = await view.findByLabelText('视频', { selector: 'div' })
    expect(player.querySelector('video')?.getAttribute('aria-label')).toBe('视频')
  })

  it('surfaces a retry control when durable bytes cannot be read, including a failed retry', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'))
      .mockResolvedValueOnce('blob:retry-video')
    const view = render(<MessageVideo attachment={attachment} load={load} labels={labels} />)
    const retry = await view.findByRole('button', { name: '视频加载失败，点击重试' })
    fireEvent.click(retry)
    const retryAgain = await view.findByRole('button', { name: '视频加载失败，点击重试' })
    fireEvent.click(retryAgain)
    const player = await view.findByLabelText('clip.mp4', { selector: 'div' })
    expect(player.querySelector('video')?.getAttribute('src')).toBe('blob:retry-video')
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('ignores a load settling after unmount', async () => {
    let resolve: ((url: string) => void) | undefined
    const load = vi.fn(() => new Promise<string>((r) => { resolve = r }))
    const view = render(<MessageVideo attachment={attachment} load={load} labels={labels} />)
    view.unmount()
    resolve?.('blob:late')
    await Promise.resolve()
    let reject: ((error: Error) => void) | undefined
    const failing = vi.fn(() => new Promise<string>((_r, rej) => { reject = rej }))
    const second = render(<MessageVideo attachment={attachment} load={failing} labels={labels} />)
    second.unmount()
    reject?.(new Error('late failure'))
    await Promise.resolve()
  })
})

describe('VideoGallery', () => {
  it('renders nothing without videos and an aligned wrapping group with them', async () => {
    const load = vi.fn().mockResolvedValue('blob:gallery-video')
    const empty = render(<VideoGallery videos={[]} load={load} align="start" labels={labels} />)
    expect(empty.container.firstChild).toBeNull()
    const view = render(
      <VideoGallery videos={[{ attachment }, { attachment }]} load={load} align="end" labels={labels} />,
    )
    expect(view.container.querySelector('[data-align="end"]')).not.toBeNull()
    await waitFor(() => {
      expect(view.getAllByLabelText('clip.mp4', { selector: 'div' })).toHaveLength(2)
    })
  })
})
