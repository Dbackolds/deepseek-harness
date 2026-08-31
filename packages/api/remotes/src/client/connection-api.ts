/**
 * Compatibility projection of `ctx.remote` onto the historical
 * `connection.api` unary face used by Client plugins compiled against
 * `dsh-client-connection` before the Typert Remote split.
 */

import type {
  ConfigurableProviderView,
  ConnectionApi,
  ConnectionHandle,
  ModelCatalogFailure,
  ModelCatalogModel,
  ModelProviderGroup,
} from '@deepseek-ai/dsh-client-connection/client'
import { RpcId } from '@deepseek-ai/dsh-client-connection/client'
import type { LlmConfigurableProvider, LlmProviderInfo } from '@deepseek-ai/dsh-llm/types'
import type { SettingsDescribeValue, SettingsNamespaceView } from '@deepseek-ai/dsh-settings/types'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client'

/** One correlation id shared by every compatibility envelope. Callers read `result` only. */
const COMPAT_RPC_ID = RpcId('connection-api')

/** Wrap a Remote result in the historical unary envelope. */
function wrap<T>(result: RemoteResult<T>): { readonly rpcId: typeof COMPAT_RPC_ID; readonly result: RemoteResult<T> } {
  return { rpcId: COMPAT_RPC_ID, result }
}

/** Narrow an unknown settings value to a plain record. */
function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** Read a string field from an unknown record. */
function stringField(value: unknown, key: string): string | undefined {
  const field = recordOf(value)?.[key]
  return typeof field === 'string' ? field : undefined
}

/**
 * Join live routes with the configurable directory into the historical
 * `llm.providers` rows.
 * @param registered - currently registered provider routes.
 * @param declared - configurable-provider directory.
 * @returns historical provider views.
 */
export function joinHistoricalProviders(
  registered: readonly LlmProviderInfo[],
  declared: readonly LlmConfigurableProvider[],
): ConfigurableProviderView[] {
  const active = new Set(registered.map(entry => entry.id))
  const providers: ConfigurableProviderView[] = declared.map(entry => ({
    provider: entry.provider,
    displayName: entry.displayName,
    settingsNs: entry.settingsNs,
    active: active.has(entry.provider),
  }))
  const declaredIds = new Set(declared.map(entry => entry.provider))
  for (const entry of registered) {
    if (declaredIds.has(entry.id)) continue
    providers.push({
      provider: entry.id,
      displayName: entry.name,
      settingsNs: '',
      active: true,
    })
  }
  return providers
}

/**
 * Build the historical provider-grouped catalog from the settings document
 * and live routes. Groups without advertised models are omitted.
 * @param settings - redacted settings descriptor.
 * @param registered - currently registered provider routes.
 * @param declared - configurable-provider directory.
 * @returns historical catalog groups.
 */
export function catalogFromDescribe(
  settings: SettingsDescribeValue,
  registered: readonly LlmProviderInfo[],
  declared: readonly LlmConfigurableProvider[],
): { groups: ModelProviderGroup[]; failures: ModelCatalogFailure[] } {
  const activeIds = new Set(registered.map(entry => entry.id))
  const declaredById = new Map(declared.map(entry => [entry.provider, entry]))
  const namespace = settings.namespaces.find(entry => entry.ns === 'llm-pi-ai')
  const resolvedProviders = recordOf(recordOf(namespace?.value)?.providers) ?? {}
  const groups: ModelProviderGroup[] = []
  const pushGroup = (id: string, name: string, models: ModelCatalogModel[]): void => {
    if (models.length === 0) return
    groups.push({ id, name, models })
  }
  for (const [provider, profile] of Object.entries(resolvedProviders)) {
    if (!activeIds.has(provider)) continue
    const declaredEntry = declaredById.get(provider)
    const registeredEntry = registered.find(entry => entry.id === provider)
    /* v8 ignore next -- activeIds is built from registered ids, so a live profile always has a route. */
    if (registeredEntry === undefined) continue
    const models: ModelCatalogModel[] = []
    const rawModels = recordOf(profile)?.models
    if (Array.isArray(rawModels)) {
      for (const raw of rawModels) {
        const id = stringField(raw, 'id')
        if (id === undefined || id.length === 0) continue
        models.push({ id, name: stringField(raw, 'name') ?? id })
      }
    }
    pushGroup(provider, declaredEntry?.displayName ?? registeredEntry.name, models)
  }
  return { groups, failures: [] }
}

/**
 * Project `ctx.remote.llm` / `ctx.remote.settings` onto `connection.api`.
 * @param remote - typed Client Remote after llm and settings namespaces mount.
 * @returns historical unary API.
 */
export function createConnectionApi(remote: ClientRemote): ConnectionApi {
  const llm = remote.llm
  const settings = remote.settings
  return {
    llm: {
      async providers() {
        const [registered, declared] = await Promise.all([
          llm.listProviders(),
          llm.listConfigurableProviders(),
        ])
        if (!registered.ok) return wrap(registered)
        if (!declared.ok) return wrap(declared)
        return wrap({
          ok: true,
          value: { providers: joinHistoricalProviders(registered.value, declared.value) },
        })
      },
      async models() {
        const [registered, declared, described] = await Promise.all([
          llm.listProviders(),
          llm.listConfigurableProviders(),
          settings.describe(),
        ])
        if (!registered.ok) return wrap(registered)
        if (!declared.ok) return wrap(declared)
        if (!described.ok) return wrap(described)
        return wrap({
          ok: true,
          value: catalogFromDescribe(described.value, registered.value, declared.value),
        })
      },
    },
    settings: {
      async describe() {
        return wrap(await settings.describe())
      },
      async update(payload: {
        ns: string
        patch: Record<string, JsonValue>
        expectedRevision?: number
      }) {
        return wrap(await settings.update(payload.ns, payload.patch, payload.expectedRevision))
      },
    },
  }
}

/**
 * Install the historical `connection.api` face, and restore the previous value
 * when the assembly unloads.
 * @param connection - live Connection handle.
 * @param remote - typed Client Remote after llm and settings namespaces mount.
 * @returns disposer restoring the previous `api` slot.
 */
export function installConnectionApi(connection: ConnectionHandle, remote: ClientRemote): () => void {
  const previous = connection.api
  connection.api = createConnectionApi(remote)
  return () => {
    if (previous === undefined) delete connection.api
    else connection.api = previous
  }
}

export type { SettingsNamespaceView }
