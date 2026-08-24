/**
 * Process-wide fetch wrapper that repairs OpenAI-compatible SSE JSON before
 * the OpenAI SDK parses it. pi-ai constructs the SDK client without a `fetch`
 * hook, so the only injection point is `globalThis.fetch`.
 *
 * Installation is idempotent and reference-counted: overlapping adapter
 * streams share one wrapper, and the last disposer restores the previous
 * `fetch`.
 *
 * @module dsh-llm-pi-ai/openai-sse-fetch
 */

import { repairSseJsonResponse } from './sse-json-repair.ts'

type FetchFn = typeof globalThis.fetch

let installed: FetchFn | undefined
let previous: FetchFn | undefined
let leases = 0

/**
 * Install the process-wide SSE JSON repair wrapper around `globalThis.fetch`.
 * @returns a disposer that drops this lease; the last lease restores the previous fetch.
 */
export function acquireOpenAiSseFetchRepair(): () => void {
  if (installed === undefined) {
    previous = globalThis.fetch
    const upstream = previous.bind(globalThis)
    const wrapped: FetchFn = async (input, init) => {
      const response = await upstream(input, init)
      return repairSseJsonResponse(response)
    }
    installed = wrapped
    globalThis.fetch = wrapped
  }
  leases += 1
  let released = false
  return () => {
    if (released) return
    released = true
    leases -= 1
    if (leases > 0 || installed === undefined) return
    if (globalThis.fetch === installed && previous !== undefined) {
      globalThis.fetch = previous
    }
    installed = undefined
    previous = undefined
  }
}
