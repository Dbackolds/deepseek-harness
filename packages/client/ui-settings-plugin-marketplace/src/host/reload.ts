/** Match Loader entries and reload plugins without tearing down the GUI transport. */

/** Live HTTP, session, and command path. Extra / overlay plugins stay reloadable. */
export const SKELETON_LEAF_IDS = new Set([
  'webserver',
  'connection',
  'client-hmr',
  'modules',
  'api-gateway',
  'api-remotes',
  'web-startup',
  'web-runtime',
  'client-runtime',
  'cordis-host-runner',
  'cordis-client-runner',
  'commands',
  'settings',
  'session',
  'agent',
  'agent-loop',
  'llm',
  'typert',
  'typert-loader',
  'typert-gateway',
  'storage',
  'storage-json',
  'storage-domain',
  'session-persistence-jsonl',
  'include',
  'timer',
  'hmr',
])

export interface ReloadableEntry {
  readonly id: string
  readonly moduleName: string
  readonly enabled: boolean
  fiber?: ReloadFiber | undefined
  refresh(): Promise<unknown>
  reload?(): Promise<unknown>
}

export interface ReloadFiber {
  dispose(): Promise<unknown>
  await(): Promise<unknown>
  readonly runtime?: { readonly callback?: unknown } | null
  readonly inertia?: Promise<unknown>
}

export interface ReloadMatch {
  readonly id: string
  readonly moduleName: string
}

export type ReloadMatchResult =
  | { readonly kind: 'all' }
  | { readonly kind: 'one'; readonly entry: ReloadMatch }
  | { readonly kind: 'none'; readonly query: string; readonly suggestions: readonly string[] }
  | { readonly kind: 'ambiguous'; readonly query: string; readonly matches: readonly ReloadMatch[] }

export function packageNameOf(moduleName: string): string {
  if (moduleName.startsWith('@')) {
    const parts = moduleName.split('/')
    return parts.slice(0, 2).join('/')
  }
  return moduleName.split('/')[0] ?? moduleName
}

export function leafEntryId(id: string): string {
  const parts = id.split(':')
  return parts[parts.length - 1] ?? id
}

export function isMarketplaceEntry(id: string, moduleName: string): boolean {
  return packageNameOf(moduleName) === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'
    || leafEntryId(id) === 'plugin-marketplace'
    || leafEntryId(id) === 'ui-settings-plugin-marketplace'
}

/**
 * Browser plugins that hold the live page together. Native HMR never
 * unloads these as a group; swapping them blanks the window.
 */
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

export function isClientSkeletonPackage(packageName: string): boolean {
  return CLIENT_SKELETON_PACKAGES.has(packageName)
}

export function isMarketplaceClientPackage(packageName: string): boolean {
  return packageName === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'
}

export function matchesReloadQuery(
  packageName: string,
  matched: { readonly id: string; readonly moduleName: string },
): boolean {
  const leaf = leafEntryId(matched.id)
  return packageName === packageNameOf(matched.moduleName)
    || packageName === matched.moduleName
    || packageName === matched.id
    || leafEntryId(packageName) === leaf
}

/**
 * Overlay UI bundles first, marketplace last. Connection/runtime stay mounted.
 */
export function selectClientReloadIds(
  clientIds: readonly string[],
  matched: Extract<ReloadMatchResult, { kind: 'all' } | { kind: 'one' }>,
): readonly string[] {
  const overlay: string[] = []
  const marketplace: string[] = []
  for (const id of clientIds) {
    if (isClientSkeletonPackage(id)) continue
    if (isMarketplaceClientPackage(id)) marketplace.push(id)
    else overlay.push(id)
  }
  const ordered = [...overlay, ...marketplace]
  if (matched.kind === 'all') return marketplace
  return ordered.filter(id => matchesReloadQuery(id, matched.entry))
}

/** `include:agent-presets` is a tree carrier. Its children stay reloadable. */
export function isIncludeContainer(id: string): boolean {
  return /^include:[^:]+$/.test(id)
}

export function isSkeletonEntry(id: string, moduleName: string): boolean {
  if (isMarketplaceEntry(id, moduleName)) return false
  return isIncludeContainer(id) || SKELETON_LEAF_IDS.has(leafEntryId(id))
}

export function partitionReloadEntries(entries: readonly ReloadableEntry[]): {
  readonly others: readonly ReloadableEntry[]
  readonly marketplace: readonly ReloadableEntry[]
} {
  const others: ReloadableEntry[] = []
  const marketplace: ReloadableEntry[] = []
  for (const entry of entries) {
    if (isMarketplaceEntry(entry.id, entry.moduleName)) marketplace.push(entry)
    else others.push(entry)
  }
  return { others, marketplace }
}

export interface ReloadProgress {
  readonly phase: 'idle' | 'running' | 'done'
  readonly current: string
  readonly index: number
  readonly total: number
  readonly ok: number
  readonly failed: number
  readonly message: string
}

export const IDLE_RELOAD_PROGRESS: ReloadProgress = {
  phase: 'idle', current: '', index: 0, total: 0, ok: 0, failed: 0, message: '',
}

export function snapshotFromSettings(section: {
  reloadNonce?: number
  reloadClientIds?: readonly string[]
  reloadProgress?: Partial<ReloadProgress>
  rebootNonce?: number
} | undefined): {
  readonly phase: ReloadProgress['phase']
  readonly current: string
  readonly index: number
  readonly total: number
  readonly ok: number
  readonly failed: number
  readonly message: string
  readonly nonce: number
  readonly clientIds: readonly string[]
  readonly names: readonly string[]
  readonly rebootNonce: number
} {
  const progress = section?.reloadProgress
  const phase = progress?.phase === 'running' || progress?.phase === 'done' ? progress.phase : 'idle'
  return {
    phase,
    current: typeof progress?.current === 'string' ? progress.current : '',
    index: typeof progress?.index === 'number' ? progress.index : 0,
    total: typeof progress?.total === 'number' ? progress.total : 0,
    ok: typeof progress?.ok === 'number' ? progress.ok : 0,
    failed: typeof progress?.failed === 'number' ? progress.failed : 0,
    message: typeof progress?.message === 'string' ? progress.message : '',
    nonce: typeof section?.reloadNonce === 'number' ? section.reloadNonce : 0,
    clientIds: Array.isArray(section?.reloadClientIds)
      ? section.reloadClientIds.filter((id): id is string => typeof id === 'string')
      : [],
    names: Array.isArray((section as { reloadNames?: unknown } | undefined)?.reloadNames)
      ? ((section as { reloadNames?: unknown }).reloadNames as unknown[])
        .filter((id): id is string => typeof id === 'string')
      : [],
    rebootNonce: typeof section?.rebootNonce === 'number' ? section.rebootNonce : 0,
  }
}

export async function writeReloadProgress(
  settings: { update?: (ns: unknown, patch: object) => Promise<unknown> } | undefined,
  ns: unknown,
  progress: ReloadProgress,
): Promise<void> {
  await settings?.update?.(ns, { reloadProgress: progress })
}

export function normalizeQuery(raw: string): string {
  return raw.trim().toLocaleLowerCase()
}

export function matchReloadTarget(
  entries: readonly ReloadMatch[],
  rawInput: string,
): ReloadMatchResult {
  const query = normalizeQuery(rawInput)
  if (query.length === 0) return { kind: 'all' }
  const exact = entries.filter(entry =>
    entry.id.toLocaleLowerCase() === query || entry.moduleName.toLocaleLowerCase() === query)
  const onlyExact = exact[0]
  if (exact.length === 1 && onlyExact !== undefined) return { kind: 'one', entry: onlyExact }
  if (exact.length > 1) return { kind: 'ambiguous', query: rawInput.trim(), matches: exact }
  const suggestions = entries
    .filter(entry => entry.id.toLocaleLowerCase().includes(query) || entry.moduleName.toLocaleLowerCase().includes(query))
    .slice(0, 8)
    .map(entry => entry.id)
  return { kind: 'none', query: rawInput.trim(), suggestions }
}

export function formatReloadAccepted(
  entries: readonly { readonly id: string; readonly moduleName?: string }[],
  clientIds: readonly string[] = [],
): string {
  const names = entries.map(entry => entry.id)
  for (const id of clientIds) {
    const already = entries.some(entry =>
      entry.id === id
      || packageNameOf(entry.moduleName ?? '') === id
      || leafEntryId(entry.id) === leafEntryId(id))
    if (!already) names.push(id)
  }
  if (names.length === 0) return '没有可热重载的插件。连接骨架请用 /reboot。'
  return [
    `正在重载 ${String(names.length)} 个插件`,
    '',
    ...names,
  ].join('\n')
}

export function formatReloadFinished(
  ok: number,
  failed: number,
): string {
  if (failed === 0) return `重载完成, 成功重载 ${String(ok)} 个插件`
  return `重载完成, 成功重载 ${String(ok)} 个插件, 失败 ${String(failed)} 个`
}

/** First-line summary plus the plugin id list official command cards expand. */
export function formatReloadOutcome(
  summary: string,
  names: readonly string[],
): string {
  if (names.length === 0) return summary
  return [summary, '', ...names].join('\n')
}

export function selectReloadEntries(
  entries: readonly ReloadableEntry[],
  matched: Extract<ReloadMatchResult, { kind: 'all' } | { kind: 'one' }>,
):
  | { readonly ok: true; readonly selected: readonly ReloadableEntry[]; readonly skipped: number }
  | { readonly ok: false; readonly message: string } {
  if (matched.kind === 'one') {
    const entry = entries.find(item => item.id === matched.entry.id)
    if (entry === undefined) return { ok: false, message: `没有匹配 ${JSON.stringify(matched.entry.id)} 的插件。` }
    if (isSkeletonEntry(entry.id, entry.moduleName)) {
      return { ok: false, message: `${entry.id} 维持当前连接，不能热重载。请运行 /reboot。` }
    }
    return { ok: true, selected: [entry], skipped: 0 }
  }
  const selected = entries.filter(entry =>
    entry.enabled && !isSkeletonEntry(entry.id, entry.moduleName))
  return { ok: true, selected, skipped: entries.filter(entry => entry.enabled).length - selected.length }
}

export async function reloadHostEntry(
  entry: ReloadableEntry,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!entry.enabled) return { ok: false, message: `条目 ${entry.id} 已停用` }
  try {
    if (entry.reload !== undefined) {
      await entry.reload()
      return { ok: true }
    }
    const fiber = entry.fiber
    if (fiber !== undefined) {
      entry.fiber = undefined
      await fiber.dispose()
      while (fiber.inertia !== undefined) await fiber.inertia
    }
    await entry.refresh()
    await entry.fiber?.await()
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function requestBrowserReload(
  settings: {
    get?: (ns: unknown) => { reloadNonce?: number; reloadNames?: readonly string[] }
    update?: (ns: unknown, patch: object) => Promise<unknown>
  } | undefined,
  ns: unknown,
  clientIds: readonly string[] = [],
  names: readonly string[] = [],
): Promise<string> {
  if (settings?.update === undefined) return '未能请求浏览器重载（settings 不可用）'
  const current = settings.get?.(ns)
  await settings.update(ns, {
    reloadNonce: (current?.reloadNonce ?? 0) + 1,
    reloadClientIds: [...clientIds],
    reloadNames: names.length > 0 ? [...names] : [...(current?.reloadNames ?? [])],
  })
  return clientIds.length === 0
    ? '已请求浏览器重载插件市场页面'
    : `已请求浏览器重载 ${String(clientIds.length)} 个界面插件`
}

/** Bump a persistent nonce so the desktop page reloads after Host restart. */
export async function requestBrowserReboot(
  settings: {
    get?: (ns: unknown) => { rebootNonce?: number }
    update?: (ns: unknown, patch: object) => Promise<unknown>
  } | undefined,
  ns: unknown,
): Promise<number> {
  const next = (settings?.get?.(ns)?.rebootNonce ?? 0) + 1
  await settings?.update?.(ns, { rebootNonce: next })
  return next
}
