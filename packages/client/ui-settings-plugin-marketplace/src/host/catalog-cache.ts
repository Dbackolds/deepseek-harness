/** Persist and reassemble Discover catalog snapshots between fetches. */

import { sourceTitleFromUrl } from './catalog.ts'
import type { CatalogPlugin, CatalogSnapshot, CatalogSource } from './types.ts'

export interface CachedCatalogSource extends CatalogSource {
  readonly entries: readonly CatalogPlugin[]
}

export interface CatalogCache {
  readonly fetchedAt: number
  readonly sources: readonly CachedCatalogSource[]
}

export function emptyCache(): CatalogCache {
  return { fetchedAt: 0, sources: [] }
}

export function isCatalogCache(value: unknown): value is CatalogCache {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  if (typeof row.fetchedAt !== 'number' || !Array.isArray(row.sources)) return false
  return row.sources.every(isCachedSource)
}

function isCachedSource(value: unknown): value is CachedCatalogSource {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.url === 'string'
    && typeof row.title === 'string'
    && typeof row.ok === 'boolean'
    && typeof row.count === 'number'
    && Array.isArray(row.entries)
}

export function pruneCacheToUrls(cache: CatalogCache, urls: readonly string[]): CatalogCache {
  const keep = new Set(urls)
  return {
    fetchedAt: cache.fetchedAt,
    sources: cache.sources.filter(source => keep.has(source.url)),
  }
}

export function mergeCachedSource(
  cache: CatalogCache | undefined,
  source: CachedCatalogSource,
  fetchedAt = Date.now(),
): CatalogCache {
  const previous = cache === undefined ? emptyCache() : cache
  const sources = previous.sources.filter(item => item.url !== source.url)
  sources.push(source)
  return { fetchedAt, sources }
}

export function snapshotFromCache(
  urls: readonly string[],
  cache: CatalogCache | undefined,
): CatalogSnapshot | undefined {
  if (urls.length === 0) return undefined
  const byUrl = new Map((cache?.sources ?? []).map(source => [source.url, source]))
  const sources: CatalogSource[] = []
  const entries: CatalogPlugin[] = []
  const seen = new Set<string>()
  let hit = false
  for (const url of urls) {
    const cached = byUrl.get(url)
    if (cached === undefined) {
      sources.push({ url, title: sourceTitleFromUrl(url), ok: true, count: 0 })
      continue
    }
    hit = true
    sources.push({
      url: cached.url,
      title: cached.title,
      ok: cached.ok,
      error: cached.error,
      count: cached.count,
    })
    for (const entry of cached.entries) {
      if (seen.has(entry.name)) continue
      seen.add(entry.name)
      entries.push(entry)
    }
  }
  if (!hit && (cache === undefined || cache.sources.length === 0)) return undefined
  return {
    configured: true,
    sources,
    entries,
    fetchedAt: cache?.fetchedAt ?? 0,
    stale: !hit || sources.some(source => byUrl.get(source.url) === undefined),
  }
}

export function cachedSourceFromFetch(
  source: CatalogSource,
  entries: readonly CatalogPlugin[],
): CachedCatalogSource {
  return { ...source, entries }
}
