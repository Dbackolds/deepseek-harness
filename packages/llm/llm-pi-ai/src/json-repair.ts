/**
 * Repair OpenAI-compatible SSE JSON that embeds raw control characters or an
 * unterminated string. Grok and similar gateways emit tool-call `arguments`
 * with real newlines and unescaped quotes inside JSON string literals; the
 * OpenAI SDK then throws `SyntaxError` and the turn ends as `PI_AI_ERROR`
 * before any tool runs.
 *
 * The walker is string-literal local: it does not invent keys or values,
 * does not drop bytes, and leaves already-valid JSON unchanged. The only
 * structural additions are closing a still-open string and then unmatched
 * `{` / `[`, so a truncated tool-call payload can reach the harness as a
 * tool call instead of a turn failure.
 *
 * @module dsh-llm-pi-ai/json-repair
 */

const VALID_JSON_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't'])

/**
 * Whether `char` is a JSON-forbidden C0 control character.
 * @param char - a single UTF-16 code unit, or empty at EOF.
 * @returns true for U+0000 through U+001F.
 */
function isControlCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0)
  return codePoint !== undefined && codePoint >= 0x00 && codePoint <= 0x1f
}

/**
 * Encode one C0 control character as a JSON escape.
 * @param char - a single C0 control character.
 * @returns the matching short escape, or a `\\u00xx` form.
 */
function escapeControlCharacter(char: string): string {
  switch (char) {
    case '\b': return '\\b'
    case '\f': return '\\f'
    case '\n': return '\\n'
    case '\r': return '\\r'
    case '\t': return '\\t'
    default:
      return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  }
}

/**
 * Escape raw C0 controls and invalid backslash sequences inside JSON string
 * literals, and close a string that is still open at EOF.
 * @param json - a complete JSON document, possibly with illegal string bytes.
 * @returns a document whose string literals are legal JSON; identity when none needed repairing.
 */
export function repairJsonStringLiterals(json: string): string {
  let repaired = ''
  let inString = false
  for (let index = 0; index < json.length; index++) {
    const char = json[index] as string
    if (!inString) {
      repaired += char
      if (char === '"') inString = true
      continue
    }
    if (char === '"') {
      repaired += char
      inString = false
      continue
    }
    if (char === '\\') {
      const nextChar = json[index + 1]
      if (nextChar === undefined) {
        repaired += '\\\\'
        continue
      }
      if (nextChar === 'u') {
        const unicodeDigits = json.slice(index + 2, index + 6)
        if (/^[0-9a-fA-F]{4}$/.test(unicodeDigits)) {
          repaired += `\\u${unicodeDigits}`
          index += 5
          continue
        }
        repaired += '\\\\'
        continue
      }
      if (VALID_JSON_ESCAPES.has(nextChar)) {
        repaired += `\\${nextChar}`
        index += 1
        continue
      }
      repaired += '\\\\'
      continue
    }
    repaired += isControlCharacter(char) ? escapeControlCharacter(char) : char
  }
  if (inString) repaired += '"'
  return repaired
}

/**
 * Close unmatched `{` / `[` after string literals are already legal JSON.
 * Used only for a truncated SSE event so the OpenAI SDK can finish the chunk;
 * it never invents keys or values.
 * @param json - a document whose string literals are already valid JSON.
 * @returns the same document with trailing containers closed, or the input when already balanced.
 */
export function closeUnterminatedJsonContainers(json: string): string {
  const stack: Array<'{' | '['> = []
  let inString = false
  for (let index = 0; index < json.length; index++) {
    const char = json[index] as string
    if (inString) {
      if (char === '\\') {
        if (index + 1 < json.length) index += 1
        continue
      }
      if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') stack.push('{')
    else if (char === '[') stack.push('[')
    else if (char === '}' || char === ']') stack.pop()
  }
  if (stack.length === 0) return json
  let suffix = ''
  for (let index = stack.length - 1; index >= 0; index--) {
    suffix += stack[index] === '{' ? '}' : ']'
  }
  return json + suffix
}

/**
 * Parse JSON, repairing illegal string literals and truncated containers only
 * when the first parse fails.
 * @param json - a complete JSON document.
 * @returns the parsed value.
 * @throws SyntaxError when both the original and the repaired text are invalid JSON.
 */
export function parseJsonRepairingStringLiterals(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch (error: unknown) {
    const repaired = closeUnterminatedJsonContainers(repairJsonStringLiterals(json))
    if (repaired === json) throw error
    return JSON.parse(repaired)
  }
}

/** OpenAI-compatible SSE terminal payload; not JSON. */
const DONE = '[DONE]'

/**
 * Keep an SSE `data:` payload on one line so a later newline cannot split it.
 * Spacing is preserved when the document already has no CR or LF.
 * @param json - a document that `JSON.parse` already accepted.
 * @returns the same text, or compact JSON when the document contained a newline.
 */
function singleLineJson(json: string): string {
  if (!/[\r\n]/.test(json)) return json
  return JSON.stringify(JSON.parse(json))
}

/**
 * Repair one SSE `data:` payload that the OpenAI SDK will `JSON.parse`.
 * `[DONE]` is returned unchanged. A payload that is already valid JSON and
 * contains no CR or LF is returned unchanged so object key order and spacing
 * survive. A valid payload that contains a newline is re-serialized onto one
 * line so a later SSE splitter cannot break it.
 * @param data - the SSE event data field, without the `data: ` prefix.
 * @returns a payload the OpenAI SDK can parse, or the original text when repair cannot produce JSON.
 */
export function repairSseJsonData(data: string): string {
  const trimmed = data.trim()
  if (trimmed.length === 0 || trimmed === DONE) return data
  try {
    JSON.parse(data)
    return singleLineJson(data)
  } catch {
    const repaired = closeUnterminatedJsonContainers(repairJsonStringLiterals(data))
    try {
      JSON.parse(repaired)
      return singleLineJson(repaired)
    } catch {
      return data
    }
  }
}
