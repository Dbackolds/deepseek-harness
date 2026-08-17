export type PluginFiberPhase =
  | 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'mixed' | null

export type InstalledPluginKind = 'bundle' | 'dependency' | 'inbox'

export interface InstalledPlugin {
  readonly packageName: string
  readonly spec: string
  readonly kind: InstalledPluginKind
  readonly installed: boolean
  readonly entryIds: readonly string[]
  readonly enabled: boolean
  readonly fiberPhase: PluginFiberPhase
  readonly canUninstall: boolean
  readonly canToggle: boolean
  readonly note: string
  readonly tags: readonly string[]
}

export interface InstalledPluginSnapshot {
  readonly profileName: string
  readonly entries: readonly InstalledPlugin[]
}

export type CatalogPluginKind = 'bundle' | 'plugin'

export interface CatalogPlugin {
  readonly name: string
  readonly version: string
  readonly title: string
  readonly description: string
  readonly homepage: string
  readonly kind: CatalogPluginKind
  readonly sourceUrl: string
  readonly sourceTitle: string
  /** npm publish time of the pinned version, as UTC ISO-8601. */
  readonly updatedAt?: string
}

export interface CatalogSource {
  readonly url: string
  readonly title: string
  readonly ok: boolean
  readonly error?: string | undefined
  readonly count: number
}

export interface CatalogSnapshot {
  readonly configured: boolean
  readonly sources: readonly CatalogSource[]
  readonly entries: readonly CatalogPlugin[]
  readonly fetchedAt?: number
  readonly stale?: boolean
  readonly refreshing?: boolean
}

export interface PluginMutationSuccess { readonly ok: true; readonly restartRequired: true }
export interface PluginEnableSuccess { readonly ok: true }
export type PluginMarketplaceErrorCode =
  | 'catalog-unconfigured' | 'catalog-invalid' | 'catalog-fetch-failed'
  | 'package-invalid' | 'version-invalid' | 'not-installed' | 'protected'
  | 'not-toggleable' | 'entry-missing' | 'pnpm-missing' | 'pnpm-failed' | 'busy'
export interface PluginMarketplaceFailure {
  readonly ok: false
  readonly code: PluginMarketplaceErrorCode
  readonly message: string
}
export type PluginMutationResult = PluginMutationSuccess | PluginMarketplaceFailure
export type PluginEnableResult = PluginEnableSuccess | PluginMarketplaceFailure
export interface InstallPluginRequest { readonly name: string; readonly version?: string }
export interface UninstallPluginRequest { readonly name: string }
export interface SetEnabledRequest { readonly entryId: string; readonly enabled: boolean }

export interface ReloadProgressSnapshot {
  readonly phase: 'idle' | 'running' | 'done'
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
}
