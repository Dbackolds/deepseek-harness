import { describe, expect, it } from 'vitest'
import {
  closeUnterminatedJsonContainers,
  parseJsonRepairingStringLiterals,
  repairJsonStringLiterals,
  repairSseJsonData,
} from '../src/json-repair.ts'

describe('repairJsonStringLiterals', () => {
  it('leaves valid JSON unchanged', () => {
    const json = JSON.stringify({ a: 'line1\nline2', b: [1, 2] })
    expect(repairJsonStringLiterals(json)).toBe(json)
  })

  it('escapes a raw newline inside a JSON string', () => {
    const broken = '{"a":' + JSON.stringify('line1\nline2').replaceAll('\\n', '\n') + '}'
    expect(JSON.parse(repairJsonStringLiterals(broken))).toEqual({ a: 'line1\nline2' })
  })

  it('escapes raw tab, CR, and other C0 controls inside a JSON string', () => {
    const broken = '{"a":"x\ty\rz\u0008\u000c\u0001"}'
    expect(JSON.parse(repairJsonStringLiterals(broken))).toEqual({ a: 'x\ty\rz\b\f\u0001' })
  })

  it('does not rewrite controls outside strings', () => {
    const pretty = '{\n  "a": 1\n}'
    expect(repairJsonStringLiterals(pretty)).toBe(pretty)
  })

  it('doubles a trailing backslash that would leave the string open', () => {
    const broken = '{"a":"ends with \\'
    expect(JSON.parse(repairJsonStringLiterals(broken) + '}')).toEqual({ a: 'ends with \\' })
  })

  it('closes a string that is still open at EOF', () => {
    expect(JSON.parse(repairJsonStringLiterals('{"a":"unterminated') + '}')).toEqual({ a: 'unterminated' })
  })

  it('preserves a well-formed unicode escape and doubles an invalid one', () => {
    const repaired = repairJsonStringLiterals('{"a":"\\u0041\\uZZ\\q"}')
    expect(JSON.parse(repaired)).toEqual({ a: 'A\\uZZ\\q' })
  })
})

describe('parseJsonRepairingStringLiterals', () => {
  it('returns the first-parse value when the document is already JSON', () => {
    expect(parseJsonRepairingStringLiterals('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses a document whose only defect is a raw newline in a string', () => {
    const broken = '{"a":' + JSON.stringify('line1\nline2').replaceAll('\\n', '\n') + '}'
    expect(parseJsonRepairingStringLiterals(broken)).toEqual({ a: 'line1\nline2' })
  })

  it('parses a truncated string by closing it', () => {
    expect(parseJsonRepairingStringLiterals('{"a":"hi')).toEqual({ a: 'hi' })
  })

  it('closes truncated objects and arrays after repairing strings', () => {
    expect(parseJsonRepairingStringLiterals('{"a":[1,{"b":"x\\n"')).toEqual({ a: [1, { b: 'x\n' }] })
  })

  it('skips a dangling backslash at EOF while closing containers', () => {
    expect(closeUnterminatedJsonContainers('{"a":"\\')).toBe('{"a":"\\}')
  })

  it('closes a lone opening brace rather than throwing', () => {
    expect(parseJsonRepairingStringLiterals('{')).toEqual({})
  })

  it('rethrows when repair cannot produce JSON', () => {
    expect(() => parseJsonRepairingStringLiterals(':')).toThrow(SyntaxError)
  })
})

describe('repairSseJsonData', () => {
  it('leaves [DONE] and empty payloads unchanged', () => {
    expect(repairSseJsonData('[DONE]')).toBe('[DONE]')
    expect(repairSseJsonData('  [DONE]  ')).toBe('  [DONE]  ')
    expect(repairSseJsonData('')).toBe('')
    expect(repairSseJsonData('   ')).toBe('   ')
  })

  it('returns already-valid JSON identity so spacing survives', () => {
    const json = '{ "a" : 1 }'
    expect(repairSseJsonData(json)).toBe(json)
  })

  it('compacts already-valid pretty JSON onto one SSE line', () => {
    expect(repairSseJsonData('{\n  "a": 1\n}')).toBe('{"a":1}')
  })

  it('repairs a Grok-style tool-call payload with a raw newline in arguments', () => {
    const inner = JSON.stringify({ code: 'line1\nline2' }).replaceAll('\\n', '\n')
    const broken = JSON.stringify({
      choices: [{ delta: { tool_calls: [{ function: { arguments: inner } }] } }],
    }).replaceAll('\\n', '\n')
    const repaired = repairSseJsonData(broken)
    const parsed = JSON.parse(repaired) as {
      choices: [{ delta: { tool_calls: [{ function: { arguments: string } }] } }]
    }
    // One pass makes the SSE event JSON. The arguments string still carries
    // real newlines; pi-ai's argument walker repairs that second document.
    expect(parseJsonRepairingStringLiterals(parsed.choices[0].delta.tool_calls[0].function.arguments)).toEqual({
      code: 'line1\nline2',
    })
  })

  it('closes an unterminated arguments string so the SDK can parse the event', () => {
    const prefix = '{"choices":[{"delta":{"tool_calls":[{"function":{"arguments":'
    const broken = prefix + JSON.stringify('{"code":"const x = 1').slice(0, -1)
    const repaired = repairSseJsonData(broken)
    const parsed = JSON.parse(repaired) as {
      choices: [{ delta: { tool_calls: [{ function: { arguments: string } }] } }]
    }
    expect(parseJsonRepairingStringLiterals(parsed.choices[0].delta.tool_calls[0].function.arguments)).toEqual({
      code: 'const x = 1',
    })
  })

  it('returns the original text when repair still cannot parse', () => {
    expect(repairSseJsonData(':')).toBe(':')
  })
})
