/**
 * @deepseek-ai/dsh-host-plugin-catalog — serves the shipped StarPivot plugin
 * catalog JSON on a named webserver route so Discover can fetch it without
 * leaving the Host.
 * @module @deepseek-ai/dsh-host-plugin-catalog
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable Cordis plugin name. */
export const name = 'plugin-catalog'

/** Service required before the catalog route can register. */
export const inject = ['webServer']

/** Exact pathname Discover and other catalog clients fetch. */
export const CATALOG_PATH = '/plugin-catalog/catalog.json'

/** On-disk catalog shipped beside this package. */
export const CATALOG_FILE = fileURLToPath(new URL('../catalog.json', import.meta.url))

/**
 * Serve the shipped catalog document.
 * @param req - incoming HTTP request.
 * @param res - node:http response to write.
 */
export async function serveCatalog(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }
  const body = await readFile(CATALOG_FILE)
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(body.byteLength),
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}

/**
 * Register the shipped catalog route.
 * @param ctx - plugin context carrying the webServer service.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CATALOG_PATH,
    handler: serveCatalog,
  }), 'plugin-catalog: catalog route')
}
