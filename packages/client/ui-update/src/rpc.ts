/** Product-update RPC payloads and result mapping. */

import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection'
import { checkProductUpdate, ProductUpdateCheckError, type ProductUpdateCheckerOptions } from './checker.ts'
import type { ProductCheckResult, ProductUpdateSettings } from './update-settings.ts'

export { PRODUCT_UPDATE_RPC_CHANNEL } from './rpc-channel.ts'

/** Check-now request. `force` skips the 24h interval gate. */
export interface ProductUpdateCheckRequest {
  force?: boolean
}

/** Dismiss-toast request. */
export interface ProductUpdateDismissRequest {
  tag: string
}

/**
 * Handle one decoded product-update RPC endpoint.
 *
 * @param endpoint - `check` or `dismiss`.
 * @param payload - decoded request body.
 * @param options - checker IO seams.
 * @returns the existing RPC success/error result.
 */
export async function handleProductUpdateRpc(
  endpoint: string,
  payload: unknown,
  options: ProductUpdateCheckerOptions,
): Promise<ConnectionRpcResult<unknown>> {
  if (endpoint === 'check') {
    const force = readForce(payload)
    if (force === undefined) return badRequest('force must be a boolean when present')
    try {
      const value = await checkProductUpdate(options, force)
      return { ok: true, value }
    } catch (error) {
      if (isAbortError(error)) throw error
      const message = error instanceof ProductUpdateCheckError
        ? error.message
        : error instanceof Error ? error.message : String(error)
      return { ok: false, error: { code: 'internal', message, details: {} } }
    }
  }
  if (endpoint === 'dismiss') {
    const tag = readTag(payload)
    if (tag === undefined) return badRequest('tag must be a non-empty string')
    const settings = options.readSettings()
    const next: ProductUpdateSettings = { ...settings, dismissedTag: tag }
    const last = settings.lastResult
    if (last?.latest?.tag === tag) {
      const lastResult: ProductCheckResult = { ...last, available: false }
      next.lastResult = lastResult
    }
    await options.writeSettings(next)
    return { ok: true, value: { ok: true } }
  }
  return badRequest('unknown endpoint')
}

function readForce(payload: unknown): boolean | undefined {
  if (payload === null || typeof payload !== 'object') return undefined
  if (!('force' in payload) || payload.force === undefined) return false
  if (typeof payload.force !== 'boolean') return undefined
  return payload.force
}

function readTag(payload: unknown): string | undefined {
  if (payload === null || typeof payload !== 'object') return undefined
  if (!('tag' in payload) || typeof payload.tag !== 'string' || payload.tag === '') return undefined
  return payload.tag
}

function badRequest(message: string): ConnectionRpcResult<unknown> {
  return { ok: false, error: { code: 'bad-request', message, details: {} } }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
