import { describe, it } from 'vitest'
import {
  cachedSourceFromFetch, emptyCache, isCatalogCache, mergeCachedSource,
  pruneCacheToUrls, snapshotFromCache,
} from '../../src/host/catalog-cache.ts'
import type { CatalogPlugin, CatalogSource } from '../../src/host/types.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const sourceA: CatalogSource = { url: 'https://a.example/catalog.json', title: 'A', ok: true, count: 1 }
const sourceB: CatalogSource = { url: 'https://b.example/catalog.json', title: 'B', ok: true, count: 1 }
const pluginA: CatalogPlugin = {
  name: 'a', version: '1.0.0', title: 'A', description: '', homepage: '', kind: 'bundle',
  sourceUrl: sourceA.url, sourceTitle: 'A', updatedAt: '2026-08-16T17:52:31.074Z',
}
const pluginB: CatalogPlugin = {
  name: 'b', version: '1.0.0', title: 'B', description: '', homepage: '', kind: 'bundle',
  sourceUrl: sourceB.url, sourceTitle: 'B',
}

const cache = mergeCachedSource(
  mergeCachedSource(emptyCache(), cachedSourceFromFetch(sourceA, [pluginA]), 10),
  cachedSourceFromFetch(sourceB, [pluginB]),
  20,
)
assert(isCatalogCache(cache), 'cache shape')
assert(cache.fetchedAt === 20, 'latest fetch wins')
const both = snapshotFromCache([sourceA.url, sourceB.url], cache)
assert(both?.entries.map(entry => entry.name).join(',') === 'a,b', 'merged entries keep first-seen order')
assert(both?.stale !== true, 'complete cache is fresh')
const one = snapshotFromCache([sourceA.url, 'https://missing.example/catalog.json'], cache)
assert(one?.stale === true, 'missing source is stale')
assert(one?.entries.map(entry => entry.name).join(',') === 'a', 'partial cache still lists hits')
const pruned = pruneCacheToUrls(cache, [sourceB.url])
assert(pruned.sources.map(source => source.url).join(',') === sourceB.url, 'prune drops unused sources')
const missing = snapshotFromCache([sourceA.url], pruned)
assert(missing?.entries.length === 0, 'pruned source has no entries')
assert(missing?.stale === true, 'pruned source is stale')
assert(isCatalogCache({ fetchedAt: 1, sources: [] }), 'empty sources still a cache')
assert(!isCatalogCache({ fetchedAt: 'now', sources: [] }), 'rejects a non-number fetchedAt')


describe('catalog-cache', () => {
  it('holds the imported assertions', () => {})
})
