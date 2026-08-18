/** Confirm text that names the package, version, and catalog source. */

export interface ConfirmInstallListing {
  readonly name: string
  readonly version: string
  readonly sourceTitle: string
  readonly homepage: string
}

/** Prefer the catalog title; fall back to the homepage host. */
export function installSourceLabel(sourceTitle: string, homepage: string): string {
  const titled = sourceTitle.trim()
  if (titled.length > 0) return titled
  try {
    const host = new URL(homepage).host
    if (host.length > 0) return host
  } catch {
    // Homepage is optional display text, not a required URL at confirm time.
  }
  return homepage.trim()
}

/** Build the install confirm dialog through the locale `t` seat. */
export function confirmInstallMessage(
  t: (key: 'confirmInstallNamed', params?: Record<string, unknown>) => string,
  entry: ConfirmInstallListing,
): string {
  const version = entry.version.trim().length > 0 ? entry.version.trim() : 'latest'
  return t('confirmInstallNamed', {
    name: entry.name,
    version,
    source: installSourceLabel(entry.sourceTitle, entry.homepage),
  })
}
