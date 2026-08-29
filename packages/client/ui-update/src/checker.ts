/**
 * GitHub Releases poller: 24h interval, ETag, body-hash cache, and the
 * last successful result as a stale fallback.
 */

import { createHash } from 'node:crypto'
import { resolveProductChannel, releaseTagPrefix, type ProductChannelConfig } from './channel.ts'
import { githubReleasesUrl, parseGithubReleases, pickLatestRelease } from './releases.ts'
import { readProductVersion, type ProductVersionRequire } from './product-version.ts'
import type { ProductCheckResult, ProductUpdateSettings } from './update-settings.ts'

/** Default gap between GitHub polls. */
export const DEFAULT_CHECK_INTERVAL_MS = 86_400_000

/** Default GitHub request timeout. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000

/** Default repository whose Releases feed this checker reads. */
export const DEFAULT_UPDATE_REPO = 'deepseek-ai/deepseek-harness'

/** Injectable clock, fetch, and settings IO for tests. */
export interface ProductUpdateCheckerOptions {
  env?: NodeJS.ProcessEnv
  fetch?: typeof fetch
  now?: () => number
  readSettings: () => ProductUpdateSettings
  writeSettings: (next: ProductUpdateSettings) => Promise<void>
  repo?: string
  channel?: ProductChannelConfig
  intervalMs?: number
  timeoutMs?: number
  requireFn?: ProductVersionRequire
}

/** Failure the RPC layer maps to `internal`. */
export class ProductUpdateCheckError extends Error {
  override readonly name = 'ProductUpdateCheckError'
}

/**
 * Run one product-update check against GitHub Releases.
 *
 * @param options - IO seams and plugin config.
 * @param force - skip the interval gate (still honors ETag).
 * @returns the check result presented to the client.
 */
export async function checkProductUpdate(
  options: ProductUpdateCheckerOptions,
  force = false,
): Promise<ProductCheckResult> {
  const env = options.env ?? process.env
  const now = options.now ?? Date.now
  const fetchImpl = options.fetch ?? fetch
  const intervalMs = options.intervalMs ?? DEFAULT_CHECK_INTERVAL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const repo = options.repo ?? DEFAULT_UPDATE_REPO
  const channel = resolveProductChannel(options.channel ?? 'auto', env)
  const currentVersion = readProductVersion(env, options.requireFn)
  const settings = options.readSettings()
  const checkedAt = now()

  if (
    !force
    && settings.lastCheckAt !== undefined
    && checkedAt - settings.lastCheckAt < intervalMs
    && settings.lastResult !== undefined
  ) {
    return withDismiss(
      { ...settings.lastResult, currentVersion, channel, checkedAt: settings.lastCheckAt },
      settings.dismissedTag,
    )
  }

  const url = githubReleasesUrl(repo)
  if (url === undefined) {
    throw new ProductUpdateCheckError('invalid update repository')
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-product-update/' + currentVersion,
  }
  if (settings.lastCheckEtag !== undefined && settings.lastCheckEtag !== '') {
    headers['If-None-Match'] = settings.lastCheckEtag
  }

  let response: Response
  try {
    response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    return staleOrThrow(settings, currentVersion, channel, checkedAt, error)
  }

  if (response.status === 304) {
    if (settings.lastResult === undefined) {
      throw new ProductUpdateCheckError('GitHub returned 304 without a cached result')
    }
    const result = withDismiss(
      { ...settings.lastResult, currentVersion, channel, checkedAt },
      settings.dismissedTag,
    )
    await options.writeSettings(persistSuccessfulCheck(settings, {
      lastCheckAt: checkedAt,
      lastResult: result,
    }))
    return result
  }

  const remaining = response.headers.get('x-ratelimit-remaining')
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    if (settings.lastResult !== undefined) {
      return withDismiss({ ...settings.lastResult, currentVersion, channel }, settings.dismissedTag)
    }
    throw new ProductUpdateCheckError('GitHub rate limit exceeded')
  }

  if (!response.ok) {
    return staleOrThrow(
      settings,
      currentVersion,
      channel,
      checkedAt,
      new ProductUpdateCheckError('GitHub releases HTTP ' + String(response.status)),
    )
  }

  const bodyText = await response.text()
  let json: unknown
  try {
    json = JSON.parse(bodyText) as unknown
  } catch {
    // SyntaxError: GitHub returned a non-JSON body.
    return staleOrThrow(
      settings,
      currentVersion,
      channel,
      checkedAt,
      new ProductUpdateCheckError('GitHub releases body is not JSON'),
    )
  }

  const releases = parseGithubReleases(json)
  if (releases === undefined) {
    return staleOrThrow(
      settings,
      currentVersion,
      channel,
      checkedAt,
      new ProductUpdateCheckError('GitHub releases body is not a release list'),
    )
  }

  const bodyHash = sha256(bodyText)
  const etag = response.headers.get('etag') ?? undefined
  if (settings.lastCheckBodyHash === bodyHash && settings.lastResult !== undefined) {
    const result = withDismiss(
      { ...settings.lastResult, currentVersion, channel, checkedAt },
      settings.dismissedTag,
    )
    await options.writeSettings(persistSuccessfulCheck(settings, {
      lastCheckAt: checkedAt,
      lastResult: result,
      lastCheckBodyHash: bodyHash,
      ...etag === undefined ? {} : { lastCheckEtag: etag },
    }))
    return result
  }

  const latest = pickLatestRelease(releases, currentVersion, releaseTagPrefix(channel))
  const result = withDismiss({
    available: latest !== undefined,
    currentVersion,
    ...latest === undefined ? {} : { latest },
    checkedAt,
    channel,
  }, settings.dismissedTag)
  await options.writeSettings(persistSuccessfulCheck(settings, {
    lastCheckAt: checkedAt,
    lastResult: result,
    lastCheckBodyHash: bodyHash,
    ...etag === undefined ? {} : { lastCheckEtag: etag },
  }))
  return result
}

/** Persist a successful poll without writing undefined optional keys. */
function persistSuccessfulCheck(
  settings: ProductUpdateSettings,
  patch: {
    lastCheckAt: number
    lastResult: ProductCheckResult
    lastCheckBodyHash?: string
    lastCheckEtag?: string
  },
): ProductUpdateSettings {
  const { lastCheckEtag: cachedEtag, lastCheckBodyHash: cachedHash, ...rest } = settings
  const etag = patch.lastCheckEtag ?? cachedEtag
  const hash = patch.lastCheckBodyHash ?? cachedHash
  return {
    ...rest,
    lastCheckAt: patch.lastCheckAt,
    lastResult: patch.lastResult,
    ...etag === undefined ? {} : { lastCheckEtag: etag },
    ...hash === undefined ? {} : { lastCheckBodyHash: hash },
  }
}

function withDismiss(
  result: ProductCheckResult,
  dismissedTag: string | undefined,
): ProductCheckResult {
  if (result.latest !== undefined && result.latest.tag === dismissedTag) {
    return { ...result, available: false }
  }
  return result
}

function staleOrThrow(
  settings: ProductUpdateSettings,
  currentVersion: string,
  channel: ReturnType<typeof resolveProductChannel>,
  checkedAt: number,
  error: unknown,
): ProductCheckResult {
  if (settings.lastResult !== undefined) {
    return withDismiss(
      { ...settings.lastResult, currentVersion, channel, checkedAt },
      settings.dismissedTag,
    )
  }
  if (error instanceof ProductUpdateCheckError) throw error
  const message = error instanceof Error ? error.message : String(error)
  throw new ProductUpdateCheckError(message)
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
