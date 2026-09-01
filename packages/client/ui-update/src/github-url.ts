/** Shared https://github.com URL guard for persisted release links and window.open. */

/**
 * Whether `url` is an https GitHub link the Settings row may open.
 *
 * Only the exact `github.com` host is accepted: no http, no www, no lookalike
 * hostnames. Malformed strings fail closed.
 *
 * @param url - candidate release URL.
 * @returns `true` only for `https://github.com/...`.
 */
export function isGithubHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com'
  } catch {
    // TypeError: `url` is not a valid absolute URL.
    return false
  }
}
