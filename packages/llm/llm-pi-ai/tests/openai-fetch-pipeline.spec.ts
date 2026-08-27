import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireFetchPipeline,
  acquireOpenAiSseFetchRepair,
  rewriteOpenAiVideoBody,
  rewriteOpenAiVideoUrls,
} from '../src/openai-fetch-pipeline.ts'
import { requestVideoMarker } from '../src/context.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

/** Marker for one attachment id. */
const markerOf = (id: string): string => requestVideoMarker(id)

/** Videos payload for the given ids. */
const videosOf = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries))

describe('acquireFetchPipeline', () => {
  it('shares one wrapper across overlapping leases and restores after the last release', () => {
    const first = acquireFetchPipeline({})
    expect(globalThis.fetch).not.toBe(originalFetch)
    const wrapped = globalThis.fetch
    const second = acquireFetchPipeline({})
    expect(globalThis.fetch).toBe(wrapped)
    first()
    expect(globalThis.fetch).toBe(wrapped)
    second()
    expect(globalThis.fetch).toBe(originalFetch)
    first()
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it('does not restore fetch when another wrapper replaced it during the lease', () => {
    const release = acquireFetchPipeline({})
    const interloper = (async () => new Response()) as typeof fetch
    globalThis.fetch = interloper
    release()
    expect(globalThis.fetch).toBe(interloper)
  })

  it('runs onRequest hooks in order, letting each rewrite init, then upstream, then onResponse hooks', async () => {
    const seen: unknown[] = []
    const upstream = vi.fn(async (input: unknown, init?: RequestInit) => {
      seen.push(['upstream', input, init])
      return new Response('raw', { headers: { 'x-stage': 'upstream' } })
    })
    globalThis.fetch = upstream as unknown as typeof fetch
    const releaseOne = acquireFetchPipeline({
      onRequest: (init, url) => {
        seen.push(['one', init, url])
        return { ...init, headers: { ...init?.headers, 'x-one': 'set' } }
      },
    })
    const releaseTwo = acquireFetchPipeline({
      onRequest: init => ({ ...init, body: JSON.stringify({ rewritten: true }) }),
      onResponse: async response => new Response(`${await response.text()}+two`, { headers: response.headers }),
    })
    const releaseThree = acquireFetchPipeline({
      onResponse: response => new Response(`${response.headers.get('x-stage') ?? ''}|three`, { headers: response.headers }),
    })

    try {
      const response = await globalThis.fetch('https://example.invalid/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"model":"m"}',
      })
      expect(await response.text()).toBe('upstream|three')
      expect(seen[0]).toEqual(['one', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"model":"m"}' }, 'https://example.invalid/v1/chat/completions'])
      expect(seen[1]).toEqual(['upstream', 'https://example.invalid/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-one': 'set' },
        body: JSON.stringify({ rewritten: true }),
      }])
      expect(upstream).toHaveBeenCalledTimes(1)
    } finally {
      releaseOne()
      releaseTwo()
      releaseThree()
    }
    expect(globalThis.fetch).toBe(upstream as unknown as typeof fetch)
  })

  it('hands a Request input to onRequest as its URL string', async () => {
    const urls: string[] = []
    globalThis.fetch = (async () => new Response('ok')) as unknown as typeof fetch
    const release = acquireFetchPipeline({
      onRequest: (init, url) => {
        urls.push(url)
        return init
      },
    })
    try {
      await globalThis.fetch(new Request('https://example.invalid/v1/models'))
    } finally {
      release()
    }
    expect(urls).toEqual(['https://example.invalid/v1/models'])
  })
})

describe('acquireOpenAiSseFetchRepair', () => {
  it('stays a pipeline lease: it composes with a second lease instead of stacking a wrapper', () => {
    const releaseRepair = acquireOpenAiSseFetchRepair()
    const wrapped = globalThis.fetch
    const releaseOther = acquireFetchPipeline({})
    expect(globalThis.fetch).toBe(wrapped)
    releaseRepair()
    expect(globalThis.fetch).toBe(wrapped)
    releaseOther()
    expect(globalThis.fetch).toBe(originalFetch)
  })
})

describe('rewriteOpenAiVideoUrls fast path', () => {
  const markerBody = JSON.stringify({
    messages: [{ role: 'user', content: [{ type: 'text', text: markerOf('sha256:a') }] }],
  })

  it('returns the same init for a non-POST method', () => {
    const init: RequestInit = { method: 'GET', body: markerBody }
    expect(rewriteOpenAiVideoUrls(init, 'https://gw.test/v1/chat/completions', videosOf({ 'sha256:a': 'QQ' }))).toBe(init)
  })

  it('returns the same init for a URL that is not a chat-completions POST', () => {
    const init: RequestInit = { method: 'POST', body: markerBody }
    expect(rewriteOpenAiVideoUrls(init, 'https://gw.test/v1/responses', videosOf({ 'sha256:a': 'QQ' }))).toBe(init)
  })

  it('returns the same init for a non-string body', () => {
    const init: RequestInit = { method: 'POST', body: new Blob([markerBody]) }
    expect(rewriteOpenAiVideoUrls(init, 'https://gw.test/v1/chat/completions', videosOf({ 'sha256:a': 'QQ' }))).toBe(init)
  })

  it('returns the same init for a string body without a marker prefix', () => {
    const init: RequestInit = { method: 'post', body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) }
    expect(rewriteOpenAiVideoUrls(init, 'https://gw.test/v1/chat/completions', videosOf({ 'sha256:a': 'QQ' }))).toBe(init)
  })

  it('rewrites a marker-bearing chat-completions POST regardless of method case', () => {
    const rewritten = rewriteOpenAiVideoUrls(
      { method: 'post', body: markerBody },
      'https://gw.test/v1/chat/completions',
      videosOf({ 'sha256:a': 'QQ' }),
    )
    expect(rewritten).not.toBeUndefined()
    expect(rewritten?.body).toBe(rewriteOpenAiVideoBody(markerBody, videosOf({ 'sha256:a': 'QQ' })))
  })
})

describe('rewriteOpenAiVideoBody', () => {
  it('replaces marker text items in content arrays with video_url items', () => {
    const body = JSON.stringify({
      model: 'glm-5.3-flash',
      messages: [
        { role: 'user', content: [
          { type: 'text', text: 'describe' },
          { type: 'text', text: markerOf('sha256:a') },
        ] },
      ],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({ 'sha256:a': 'QUJD' }))) as {
      model: string
      messages: { content: { type: string; text?: string; video_url?: { url: string } }[] }[]
    }
    expect(rewritten.model).toBe('glm-5.3-flash')
    expect(rewritten.messages[0]?.content).toEqual([
      { type: 'text', text: 'describe' },
      { type: 'video_url', video_url: { url: 'QUJD' } },
    ])
  })

  it('degrades an unknown marker item to the unavailable placeholder', () => {
    const body = JSON.stringify({
      messages: [{ role: 'user', content: [{ type: 'text', text: markerOf('sha256:gone') }] }],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({ 'sha256:other': 'QUJD' }))) as {
      messages: { content: { type: string; text?: string }[] }[]
    }
    expect(rewritten.messages[0]?.content).toEqual([
      { type: 'text', text: '[video attachment unavailable]' },
    ])
  })

  it('moves videos out of string contents into a synthetic user message after their run', () => {
    const body = JSON.stringify({
      messages: [
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_video', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: `first\n${markerOf('sha256:a')}` },
        { role: 'tool', tool_call_id: 'c2', content: markerOf('sha256:b') },
        { role: 'user', content: 'now answer' },
      ],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({ 'sha256:a': 'QQ==', 'sha256:b': 'Qg==' }))) as {
      messages: { role: string; content: unknown; tool_call_id?: string }[]
    }
    expect(rewritten.messages).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_video', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: 'first\n' },
      { role: 'tool', tool_call_id: 'c2', content: '(video attached below)' },
      { role: 'user', content: [
        { type: 'text', text: 'Attached video(s) from tool result:' },
        { type: 'video_url', video_url: { url: 'QQ==' } },
        { type: 'video_url', video_url: { url: 'Qg==' } },
      ] },
      { role: 'user', content: 'now answer' },
    ])
  })

  it('appends the synthetic message at the end when the run closes the request', () => {
    const body = JSON.stringify({
      messages: [{ role: 'tool', tool_call_id: 'c1', content: `clip ${markerOf('sha256:a')} end` }],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({ 'sha256:a': 'QQ' }))) as {
      messages: { role: string; content: unknown }[]
    }
    expect(rewritten.messages).toEqual([
      { role: 'tool', tool_call_id: 'c1', content: 'clip  end' },
      { role: 'user', content: [
        { type: 'text', text: 'Attached video(s) from tool result:' },
        { type: 'video_url', video_url: { url: 'QQ' } },
      ] },
    ])
  })

  it('replaces an unknown marker inside a string in place without a synthetic message', () => {
    const body = JSON.stringify({
      messages: [{ role: 'tool', tool_call_id: 'c1', content: `lost ${markerOf('sha256:gone')}` }],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({}))) as {
      messages: { role: string; content: unknown }[]
    }
    expect(rewritten.messages).toEqual([
      { role: 'tool', tool_call_id: 'c1', content: 'lost [video attachment unavailable]' },
    ])
  })

  it('leaves marker-shaped text that is not a complete marker literal', () => {
    const body = JSON.stringify({
      messages: [
        { role: 'user', content: [{ type: 'text', text: '[dsh-video-request:' }] },
        { role: 'tool', tool_call_id: 'c1', content: 'edge [dsh-video-request:] and [dsh-video-request:sha256:x' },
        { role: 'user', content: [{ type: 'text', text: 'see [dsh-video-request:sha256:live] inline' }] },
      ],
    })
    const rewritten = JSON.parse(rewriteOpenAiVideoBody(body, videosOf({ 'sha256:live': 'QQ' }))) as {
      messages: { content: unknown }[]
    }
    expect(rewritten.messages[0]?.content).toEqual([{ type: 'text', text: '[dsh-video-request:' }])
    expect(rewritten.messages[1]?.content).toBe('edge [dsh-video-request:] and [dsh-video-request:sha256:x')
    expect(rewritten.messages[2]?.content).toEqual([{ type: 'text', text: 'see [dsh-video-request:sha256:live] inline' }])
  })

  it('keeps non-text items and non-content messages untouched', () => {
    const body = JSON.stringify({
      messages: [
        { role: 'user' },
        { role: 'user', content: [
          'plain-string-item',
          { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
          { type: 'text', text: 'plain' },
          null,
        ] },
        'not-a-message',
      ],
    })
    expect(JSON.parse(rewriteOpenAiVideoBody(body, videosOf({})))).toEqual(JSON.parse(body))
  })

  it('throws naming the rewrite when the body does not parse', () => {
    expect(() => rewriteOpenAiVideoBody('{"messages": [', videosOf({})))
      .toThrow(/unparseable request body/)
  })

  it('throws naming the rewrite when the body carries no messages array', () => {
    expect(() => rewriteOpenAiVideoBody('{"model":"m"}', videosOf({})))
      .toThrow(/no messages array/)
  })
})
