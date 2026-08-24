/**
 * Rewrite OpenAI-compatible SSE `data:` payloads so the OpenAI SDK can
 * `JSON.parse` them. The SDK iterates `response.body` and throws the first
 * illegal string literal; this TransformStream sits on that body before the
 * SDK reads it.
 *
 * A raw newline inside a JSON string also splits the SSE `data:` line, and
 * the remainder is not a `data:` continuation, so the SDK would drop it.
 * This walker therefore treats a blank line as an event terminator only when
 * it is not inside a JSON string, then rejoins the payload and re-emits one
 * `data:` line.
 *
 * @module dsh-llm-pi-ai/sse-json-repair
 */

import { repairSseJsonData } from './json-repair.ts'

const DATA_PREFIX = 'data:'

/**
 * Concatenate one SSE event's `data:` fields — including lines that lost
 * their `data:` prefix because a raw newline split a JSON string — and
 * repair the JSON document onto a single `data:` line.
 * @param event - the raw SSE event, without the trailing blank-line terminator.
 * @returns the same event with JSON `data:` payloads repaired onto one line.
 */
export function repairSseEvent(event: string): string {
  if (event.length === 0) return event
  const newline = event.includes('\r\n') ? '\r\n' : event.includes('\r') && !event.includes('\n') ? '\r' : '\n'
  const lines = event.split(/\r\n|\n|\r/)
  const otherLines: string[] = []
  const dataParts: string[] = []
  for (const line of lines) {
    if (line.startsWith(DATA_PREFIX)) {
      const rest = line.slice(DATA_PREFIX.length)
      dataParts.push(rest.startsWith(' ') ? rest.slice(1) : rest)
      continue
    }
    if (
      line.startsWith(':')
      || line.startsWith('event:')
      || line.startsWith('id:')
      || line.startsWith('retry:')
    ) {
      otherLines.push(line)
      continue
    }
    if (dataParts.length > 0) {
      dataParts.push(line)
      continue
    }
    otherLines.push(line)
  }
  if (dataParts.length === 0) return event
  const joined = dataParts.join('\n')
  const repaired = repairSseJsonData(joined)
  return [...otherLines, `${DATA_PREFIX} ${repaired}`].join(newline)
}

/**
 * TransformStream that repairs SSE JSON on an event-stream byte body.
 * @returns a stream transformer that accepts and emits UTF-8 SSE bytes.
 */
export function createSseJsonRepairStream(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let pending = ''
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true })
      pending = flushCompleteEvents(pending, controller, encoder)
    },
    flush(controller) {
      pending += decoder.decode()
      if (pending.length === 0) return
      controller.enqueue(encoder.encode(repairSseEvent(pending)))
      pending = ''
    },
  })
}

/**
 * Emit every complete SSE event from `buffer`, keeping an unterminated tail.
 * @param buffer - decoded text that may end mid-event.
 * @param controller - the TransformStream controller that receives UTF-8 bytes.
 * @param encoder - UTF-8 encoder reused across chunks.
 * @returns the unterminated remainder.
 */
function flushCompleteEvents(
  buffer: string,
  controller: TransformStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): string {
  let start = 0
  while (start < buffer.length) {
    const terminator = indexOfEventTerminator(buffer, start)
    if (terminator === -1) break
    const event = buffer.slice(start, terminator.index)
    const repaired = event.length === 0 ? '' : repairSseEvent(event)
    controller.enqueue(encoder.encode(`${repaired}${terminator.break}`))
    start = terminator.index + terminator.break.length
  }
  return buffer.slice(start)
}

/**
 * Locate the next blank-line SSE event terminator that is not inside a JSON
 * string. A raw newline in a tool-call argument must not close the event.
 * @param text - decoded SSE text.
 * @param from - search start index.
 * @returns the terminator index and bytes, or -1 when none remain.
 */
export function indexOfEventTerminator(
  text: string,
  from: number,
): { index: number; break: string } | -1 {
  let inString = false
  for (let index = from; index < text.length; index++) {
    if (!inString) {
      if (text.startsWith('\r\n\r\n', index)) return { index, break: '\r\n\r\n' }
      if (text.startsWith('\n\n', index)) return { index, break: '\n\n' }
      if (text.startsWith('\r\r', index)) return { index, break: '\r\r' }
    }
    const char = text[index]
    if (inString) {
      if (char === '\\') {
        if (index + 1 < text.length) index += 1
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
  }
  return -1
}

/**
 * Wrap a streaming HTTP body so SSE `data:` JSON is repaired before the SDK parses it.
 * A missing body, or a non-SSE content type, is returned unchanged.
 * @param response - the upstream fetch Response.
 * @returns the same response, or a clone whose body passes through {@link createSseJsonRepairStream}.
 */
export function repairSseJsonResponse(response: Response): Response {
  if (response.body === null) return response
  if (!isEventStream(response.headers.get('content-type'))) return response
  return new Response(response.body.pipeThrough(createSseJsonRepairStream()), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

/**
 * Whether `contentType` names an SSE body.
 * @param contentType - the response Content-Type header, or null.
 * @returns true for `text/event-stream`, ignoring parameters.
 */
function isEventStream(contentType: string | null): boolean {
  if (contentType === null) return false
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType === 'text/event-stream'
}
