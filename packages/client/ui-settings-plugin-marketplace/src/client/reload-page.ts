/** Swap overlay UI plugins through the official client-hmr sequence. */

export const MARKETPLACE_CLIENT_PACKAGE = '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'

export const CLIENT_SKELETON_PACKAGES = new Set([
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-modules',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-hmr',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-cordis-client-runner',
  '@deepseek-ai/dsh-api-gateway',
  '@deepseek-ai/dsh-typert-registry',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-settings',
])

export interface MarketplaceLoaderEntry {
  options: { name?: string }
  fiber?: MarketplaceFiber
  ctx: { registry: { delete(callback: unknown): unknown } }
  refresh(): Promise<unknown>
}

export interface MarketplaceFiber {
  runtime?: { callback?: unknown } | null
  inertia?: Promise<unknown>
  await?(): Promise<unknown>
}

export interface MarketplaceModuleLoader {
  invalidate(id: string): void
  prefetch(id: string): Promise<void>
}

export interface MarketplacePageReloadHost {
  loader?: { entries(): Iterable<MarketplaceLoaderEntry> }
  modules?: MarketplaceModuleLoader
  removeOwnedStyles?(id: string): void
}

export function findClientEntry(
  loader: { entries(): Iterable<MarketplaceLoaderEntry> },
  packageName: string,
): MarketplaceLoaderEntry | undefined {
  for (const entry of loader.entries()) {
    if (entry.options.name === packageName) return entry
  }
  return undefined
}

export function findMarketplaceClientEntry(
  loader: { entries(): Iterable<MarketplaceLoaderEntry> },
): MarketplaceLoaderEntry | undefined {
  return findClientEntry(loader, MARKETPLACE_CLIENT_PACKAGE)
}

export function selectPageReloadIds(requested: readonly string[]): string[] {
  const overlay: string[] = []
  const marketplace: string[] = []
  const seen = new Set<string>()
  for (const id of requested) {
    if (seen.has(id) || CLIENT_SKELETON_PACKAGES.has(id)) continue
    seen.add(id)
    if (id === MARKETPLACE_CLIENT_PACKAGE) marketplace.push(id)
    else overlay.push(id)
  }
  return [...overlay, ...marketplace]
}

export function removeOwnedStyles(id: string): void {
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('style[data-plugin]')) {
    if (el.getAttribute('data-plugin') === id) el.remove()
  }
}

/**
 * Official client-hmr swap for one graph id: invalidate, prefetch,
 * registry-first teardown, then refresh.
 */
export async function reloadClientPlugin(
  host: MarketplacePageReloadHost,
  packageName: string,
): Promise<'reloaded' | 'skipped'> {
  const loader = host.loader
  const modules = host.modules
  if (loader === undefined || modules === undefined) return 'skipped'
  if (CLIENT_SKELETON_PACKAGES.has(packageName)) return 'skipped'
  const entry = findClientEntry(loader, packageName)
  if (entry === undefined) return 'skipped'
  modules.invalidate(packageName)
  await modules.prefetch(packageName)
  const oldFiber = entry.fiber
  if (oldFiber !== undefined) {
    const runtime = oldFiber.runtime
    if (runtime != null) entry.ctx.registry.delete(runtime.callback)
    while (oldFiber.inertia !== undefined) await oldFiber.inertia
    delete entry.fiber
  }
  ;(host.removeOwnedStyles ?? removeOwnedStyles)(packageName)
  await entry.refresh()
  await entry.fiber?.await?.()
  return 'reloaded'
}

export async function reloadMarketplacePage(
  host: MarketplacePageReloadHost,
  requested: readonly string[] = [MARKETPLACE_CLIENT_PACKAGE],
): Promise<'reloaded' | 'skipped'> {
  const ids = selectPageReloadIds(requested.length > 0 ? requested : [MARKETPLACE_CLIENT_PACKAGE])
  let reloaded = false
  for (const id of ids) {
    if (await reloadClientPlugin(host, id) === 'reloaded') reloaded = true
  }
  return reloaded ? 'reloaded' : 'skipped'
}
