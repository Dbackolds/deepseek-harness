import { describe, expect, it } from 'vitest'
import { parseJsonRepairingStringLiterals } from '../src/json-repair.ts'
import { acquireOpenAiSseFetchRepair } from '../src/openai-fetch-pipeline.ts'
import {
  createSseJsonRepairStream,
  indexOfEventTerminator,
  repairSseEvent,
  repairSseJsonResponse,
} from '../src/sse-json-repair.ts'

describe('repairSseEvent', () => {
  it('rewrites only data JSON payloads and keeps comments and event names', () => {
    expect(repairSseEvent('')).toBe('')
    expect(repairSseEvent(': keep-alive')).toBe(': keep-alive')
    expect(repairSseEvent('event: delta')).toBe('event: delta')
    expect(repairSseEvent('id: 1')).toBe('id: 1')
    expect(repairSseEvent('retry: 1000')).toBe('retry: 1000')
    expect(repairSseEvent('data: [DONE]')).toBe('data: [DONE]')
    expect(repairSseEvent('data:{"a":1}')).toBe('data: {"a":1}')
    const broken = 'data: {"a":' + JSON.stringify('x\ny').replaceAll('\\n', '\n') + '}'
    expect(JSON.parse(repairSseEvent(broken).slice('data: '.length))).toEqual({ a: 'x\ny' })
    expect(repairSseEvent('event: delta\ndata: {"a":1}')).toBe('event: delta\ndata: {"a":1}')
    expect(repairSseEvent('orphan\ndata: {"a":1}')).toBe('orphan\ndata: {"a":1}')
    expect(repairSseEvent('event: delta\r\ndata: {"a":1}')).toBe('event: delta\r\ndata: {"a":1}')
    expect(repairSseEvent('event: delta\rdata: {"a":1}')).toBe('event: delta\rdata: {"a":1}')
  })

  it('rejoins a data payload that a raw newline split mid-string', () => {
    const inner = JSON.stringify({ code: 'line1\nline2' }).replaceAll('\\n', '\n')
    const event = JSON.stringify({
      choices: [{ delta: { tool_calls: [{ function: { arguments: inner } }] } }],
    }).replaceAll('\\n', '\n')
    const repaired = repairSseEvent(`data: ${event}`)
    expect(repaired.startsWith('data: ')).toBe(true)
    const parsed = JSON.parse(repaired.slice('data: '.length)) as {
      choices: [{ delta: { tool_calls: [{ function: { arguments: string } }] } }]
    }
    expect(parseJsonRepairingStringLiterals(parsed.choices[0].delta.tool_calls[0].function.arguments)).toEqual({
      code: 'line1\nline2',
    })
  })
})

describe('indexOfEventTerminator', () => {
  it('ignores a blank-looking newline that sits inside a JSON string', () => {
    const text = 'data: {"a":"x\n\ny"}\n\n'
    expect(indexOfEventTerminator(text, 0)).toEqual({ index: text.length - 2, break: '\n\n' })
  })

  it('recognizes CR-only and CRLF event terminators outside strings', () => {
    expect(indexOfEventTerminator('data: {"a":1}\r\r', 0)).toEqual({ index: 13, break: '\r\r' })
    expect(indexOfEventTerminator('data: {"a":1}\r\n\r\n', 0)).toEqual({ index: 13, break: '\r\n\r\n' })
    expect(indexOfEventTerminator('data: {"a":"\\n\n"}\n\n', 0)).toEqual({
      index: 'data: {"a":"\\n\n"}'.length,
      break: '\n\n',
    })
    expect(indexOfEventTerminator('data: {"a":"\\', 0)).toBe(-1)
  })
})

describe('createSseJsonRepairStream', () => {
  it('repairs a data line split across chunks, including CRLF', async () => {
    const payload = '{"a":' + JSON.stringify('line1\nline2').replaceAll('\\n', '\n') + '}'
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode('data: ' + payload.slice(0, 12)))
        controller.enqueue(encoder.encode(payload.slice(12) + '\r\n\r\n'))
        controller.close()
      },
    })
    const text = await new Response(stream.pipeThrough(createSseJsonRepairStream())).text()
    expect(text.endsWith('\r\n\r\n')).toBe(true)
    expect(JSON.parse(text.slice('data: '.length, -4))).toEqual({ a: 'line1\nline2' })
  })

  it('flushes an unterminated tail on close', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"a":"hi'))
        controller.close()
      },
    })
    const text = await new Response(stream.pipeThrough(createSseJsonRepairStream())).text()
    expect(JSON.parse(text.slice('data: '.length))).toEqual({ a: 'hi' })
  })

  it('passes an empty stream and a blank event separator through', async () => {
    const empty = new ReadableStream<Uint8Array>({ start(controller) { controller.close() } })
    expect(await new Response(empty.pipeThrough(createSseJsonRepairStream())).text()).toBe('')
    const blanks = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('\n\ndata: {"a":1}\n\n'))
        controller.close()
      },
    })
    const text = await new Response(blanks.pipeThrough(createSseJsonRepairStream())).text()
    expect(text.startsWith('\n\n')).toBe(true)
    expect(text).toContain('data: {"a":1}')
  })
})

describe('repairSseJsonResponse', () => {
  it('leaves a non-SSE body untouched', async () => {
    const body = '{"error":"no"}'
    const response = new Response(body, { headers: { 'content-type': 'application/json' } })
    const wrapped = repairSseJsonResponse(response)
    expect(wrapped).toBe(response)
    expect(await wrapped.text()).toBe(body)
  })

  it('leaves a body-less response and a missing content-type untouched', () => {
    const nobody = new Response(null, { status: 204, headers: { 'content-type': 'text/event-stream' } })
    expect(repairSseJsonResponse(nobody)).toBe(nobody)
    const untyped = new Response(new Uint8Array(), { status: 200 })
    untyped.headers.delete('content-type')
    expect(untyped.headers.get('content-type')).toBeNull()
    expect(repairSseJsonResponse(untyped)).toBe(untyped)
  })

  it('pipes an event-stream body through the repair transform', async () => {
    const payload = '{"a":' + JSON.stringify('x\ny').replaceAll('\\n', '\n') + '}'
    const response = new Response('data: ' + payload + '\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    })
    const wrapped = repairSseJsonResponse(response)
    expect(wrapped).not.toBe(response)
    const text = await wrapped.text()
    expect(JSON.parse(text.slice('data: '.length, -2))).toEqual({ a: 'x\ny' })
    expect(wrapped.status).toBe(200)
    expect(wrapped.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
  })
})

describe('acquireOpenAiSseFetchRepair', () => {
  it('wraps global fetch for overlapping leases and restores it after the last disposer', () => {
    const original = globalThis.fetch
    const first = acquireOpenAiSseFetchRepair()
    expect(globalThis.fetch).not.toBe(original)
    const wrapped = globalThis.fetch
    const second = acquireOpenAiSseFetchRepair()
    expect(globalThis.fetch).toBe(wrapped)
    first()
    expect(globalThis.fetch).toBe(wrapped)
    second()
    expect(globalThis.fetch).toBe(original)
    first()
    expect(globalThis.fetch).toBe(original)
  })

  it('does not restore fetch when another wrapper replaced it during the lease', () => {
    const original = globalThis.fetch
    const release = acquireOpenAiSseFetchRepair()
    const wrapped = globalThis.fetch
    const interloper = (async () => new Response()) as typeof fetch
    globalThis.fetch = interloper
    release()
    expect(globalThis.fetch).toBe(interloper)
    globalThis.fetch = original
    expect(wrapped).not.toBe(original)
  })

  it('repairs an SSE body returned by the wrapped fetch', async () => {
    const original = globalThis.fetch
    const payload = '{"a":' + JSON.stringify('x\ny').replaceAll('\\n', '\n') + '}'
    globalThis.fetch = (async () => new Response('data: ' + payload + '\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }))
    const release = acquireOpenAiSseFetchRepair()
    try {
      const response = await globalThis.fetch('https://example.invalid/')
      const text = await response.text()
      expect(JSON.parse(text.slice('data: '.length, -2))).toEqual({ a: 'x\ny' })
    } finally {
      release()
      globalThis.fetch = original
    }
  })
})
