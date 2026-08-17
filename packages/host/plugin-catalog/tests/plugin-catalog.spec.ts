/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the webserver and plugin-catalog rows. Assertions
 * observe the served HTTP catalog — JSON body, method gating, and route
 * release on fiber disposal (HMR safety).
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import HttpServer from '@deepseek-ai/dsh-host-webserver'
import * as PluginCatalog from '../src/index.ts'
import { CATALOG_FILE, CATALOG_PATH } from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Write a two-row cordis.yml and boot it through the real Loader. */
async function loadComposition(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-plugin-catalog-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    '- id: plugin-catalog',
    "  name: '@deepseek-ai/dsh-host-plugin-catalog'",
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-host-webserver', HttpServer],
    ['@deepseek-ai/dsh-host-plugin-catalog', PluginCatalog],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

describe('real Loader composition', () => {
  it('serves the shipped catalog and releases the route on dispose', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition()
    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    const port = loaded.webServer.port
    const expected = JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as { version: number; title: string }

    const got = await fetch(`http://127.0.0.1:${String(port)}${CATALOG_PATH}`)
    expect(got.status).toBe(200)
    expect(got.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await got.json()).toEqual(expected)
    expect(expected.version).toBe(1)
    expect(expected.title).toBe('StarPivot')

    const head = await fetch(`http://127.0.0.1:${String(port)}${CATALOG_PATH}`, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect((await fetch(`http://127.0.0.1:${String(port)}${CATALOG_PATH}`, { method: 'POST' })).status).toBe(405)

    const catalogEntry = [...loaded.loader.entries()].find(entry => entry.options.id === 'plugin-catalog')
    expect(catalogEntry).toBeDefined()
    await catalogEntry!.fiber?.dispose()
    expect((await fetch(`http://127.0.0.1:${String(port)}${CATALOG_PATH}`)).status).toBe(404)
    expect(() => loaded.webServer.register({
      kind: 'exact',
      path: CATALOG_PATH,
      handler: () => {},
    })).not.toThrow()
  })
})
