/**
 * Models settings page store: one snapshot joining the configurable-provider
 * directory (`llm.providers`), the settings namespaces (shared settings mirror),
 * and the referenced credentials (`credentials.describe`). The host stays the
 * single fact source — every mutation writes through the wire and the page
 * re-renders from the next describe, pushed or refetched.
 */

import type {
  ConfigurableProviderView, CredentialView, IApiClient, SettingsNamespaceView,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsDescribeFace } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsSchemaOperations } from './schema-operations.ts'

/**
 * Any route key walks a dict schema to the same profile node, so the lookup
 * names one that cannot collide with a configured route.
 */
const PROBE_ROUTE = '\u0000probe'

/** One provider row the page renders. */
export interface ProviderRow {
  /** The directory entry (route id, display name, settings address, live state). */
  entry: ConfigurableProviderView
  /** Whether any layer configures this provider (its profile resolves). */
  configured: boolean
  /** Whether the user layer alone carries the profile (removal restores the base). */
  removable: boolean
  /** The credential reference the resolved profile names, when one does. */
  apiKeyEnv: string | undefined
  /** Every credential reference the route or one of its models names. */
  apiKeyEnvs: readonly string[]
  /** Credential state for {@link apiKeyEnv}, once described. */
  credential: CredentialView | undefined
  /** Credential state for every named reference, once described. */
  credentials: Readonly<Record<string, CredentialView>>
}

/** Page snapshot. */
export interface ModelsSettingsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Whole-load failure text; row-level write failures stay in the editor. */
  error: string | null
  /** Credential enrichment failure; provider/settings rows remain usable. */
  credentialError: string | null
  /** Whether the settings provider accepts writes. */
  writable: boolean
  /** Every configurable provider joined with its configured/credential state. */
  rows: readonly ProviderRow[]
  /** Namespace views by ns, for the editor's schema/layers/secrets. */
  namespaces: ReadonlyMap<string, SettingsNamespaceView>
}

/**
 * Human text for a rejected wire call. A transport failure rejects with an
 * Error; a host or a runtime can reject with anything, and the page still has
 * to say something.
 * @param error - the rejection value.
 * @returns the message to show.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Derive the conventional credential reference for a provider route: the v1
 * page never asks for an environment-variable name, so a typed key stores
 * under this derived reference and the profile records it as `apiKeyEnv`.
 * @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
 * @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
 */
export function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

/**
 * Derive a POSIX-safe per-model credential reference from the route and model id.
 * @param provider - provider route id.
 * @param modelId - model identifier.
 * @returns the derived reference name.
 */
export function deriveModelKeyRef(provider: string, modelId: string): string {
  const model = modelId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  const stem = model.length === 0 || /^[0-9]/.test(model) ? `M_${model}` : model
  return `${deriveKeyRef(provider).replace(/_API_KEY$/, '')}_${stem}_API_KEY`
}


/**
 * Whether this page created the reference: the route's conventional
 * `<ROUTE>_API_KEY`, or a per-model `<ROUTE>_<MODEL>_API_KEY` it derived.
 * Custom names and environment-owned refs stay out of deletion.
 * @param provider - provider route id.
 * @param ref - credential reference name.
 * @returns whether the Models page owns this reference.
 */
export function isPageManagedRef(provider: string, ref: string): boolean {
  if (ref === deriveKeyRef(provider)) return true
  const prefix = `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_`
  return ref.startsWith(prefix) && ref.endsWith('_API_KEY')
}

/** One credential write produced while assigning per-model keys. */
export interface ModelKeyWrite {
  /** Credential reference to store. */
  ref: string
  /** Typed key value. */
  value: string
}

/**
 * Stamp `apiKeyEnv` onto models that typed a key. Identical typed values
 * share one reference — the route's, an already-named model's, or a freshly
 * derived per-model name — so one key can serve several models without a
 * second stored secret.
 * @param provider - route id used to derive a fresh reference.
 * @param models - drafted model rows.
 * @param drafts - typed-but-unsaved keys keyed by model id.
 * @param routeKeyRef - the route's conventional or named reference.
 * @param routeKeyValue - the route field's typed key, empty when unchanged.
 * @returns the stamped rows and the distinct credential writes.
 */
export function assignModelKeyRefs(
  provider: string,
  models: readonly Record<string, unknown>[],
  drafts: ReadonlyMap<string, string>,
  routeKeyRef: string,
  routeKeyValue: string,
): { models: Record<string, unknown>[]; writes: readonly ModelKeyWrite[] } {
  const valueToRef = new Map<string, string>()
  if (routeKeyValue.length > 0) valueToRef.set(routeKeyValue, routeKeyRef)
  const writes = new Map<string, string>()
  const next = models.map((model) => {
    const id = typeof model['id'] === 'string' ? model['id'] : ''
    if (id.length === 0) return { ...model }
    const typed = drafts.get(id)?.trim() ?? ''
    if (typed.length === 0) return { ...model }
    const existing = typeof model['apiKeyEnv'] === 'string' && model['apiKeyEnv'].length > 0
      ? model['apiKeyEnv']
      : undefined
    const ref = valueToRef.get(typed) ?? existing ?? deriveModelKeyRef(provider, id)
    valueToRef.set(typed, ref)
    writes.set(ref, typed)
    if (ref === routeKeyRef && existing === undefined) return { ...model }
    return existing === ref ? { ...model } : { ...model, apiKeyEnv: ref }
  })
  return { models: next, writes: [...writes].map(([ref, value]) => ({ ref, value })) }
}

/**
 * The wire protocols a hand-declared route may name, read out of the owning
 * namespace's own schema. This stays a schema read rather than a wire field so
 * the choices the page offers cannot drift from the ones the adapter accepts:
 * both come from the same `Config`.
 * @param namespace - the namespace view whose schema declares the profile shape.
 * @returns the protocol identifiers, or an empty list when the schema has none.
 */
export function protocolChoices(
  namespace: SettingsNamespaceView | undefined,
  schema: SettingsSchemaOperations,
): string[] {
  if (namespace === undefined) return []
  const node = schema.nodeAtPath(schema.rehydrate(namespace.schema), ['providers', PROBE_ROUTE, 'api'])
  const list = (node as { type?: string; list?: readonly { value?: unknown }[] } | undefined)
  if (list?.type !== 'union' || list.list === undefined) return []
  return list.list.map(entry => entry.value).filter((value): value is string => typeof value === 'string')
}

/**
 * Every credential reference a resolved profile names: the route first, then
 * each model and override that names its own, de-duplicated in encounter
 * order so a shared key is described once.
 */
function credentialRefsOf(
  namespace: SettingsNamespaceView | undefined,
  path: readonly string[],
  schema: SettingsSchemaOperations,
): string[] {
  if (namespace === undefined) return []
  const profile = schema.getPath(namespace.value, path)
  if (typeof profile !== 'object' || profile === null) return []
  const named = profile as { apiKeyEnv?: unknown; models?: unknown; modelOverrides?: unknown }
  const refs: string[] = []
  const add = (value: unknown): void => {
    if (typeof value === 'string' && value.length > 0 && !refs.includes(value)) refs.push(value)
  }
  add(named.apiKeyEnv)
  if (Array.isArray(named.models)) {
    for (const model of named.models) {
      if (typeof model === 'object' && model !== null) add((model as { apiKeyEnv?: unknown }).apiKeyEnv)
    }
  }
  if (typeof named.modelOverrides === 'object' && named.modelOverrides !== null) {
    for (const override of Object.values(named.modelOverrides)) {
      if (typeof override === 'object' && override !== null) {
        add((override as { apiKeyEnv?: unknown }).apiKeyEnv)
      }
    }
  }
  return refs
}

/** The models settings page controller (one per settings surface). */
export class ModelsSettingsStore {
  /** The snapshot the section renders from (uSES-safe store). */
  readonly store: SnapshotStore<ModelsSettingsState> = createSnapshotStore<ModelsSettingsState>({
    status: 'idle', error: null, credentialError: null, writable: false, rows: [], namespaces: new Map(),
  })

  /** Latest load wins; an older response never overwrites a newer one. */
  private generation = 0

  /**
   * @param api - the wire face (credentials/llm domains, and settings writes).
   * @param describeFace - the shared mirror's describe face (namespace views and writability).
   */
  constructor(
    private readonly api: Pick<IApiClient, 'settings' | 'credentials' | 'llm'>,
    private readonly schema: SettingsSchemaOperations,
    private readonly describeFace: SettingsDescribeFace,
  ) {}

  /**
   * Refresh the whole page snapshot: the provider directory and the mirror's
   * settings answer in parallel, then one batched credential describe over
   * every referenced ref. Provider failure or absence of an initial settings
   * answer keeps the last good rows and surfaces an error; a failed settings
   * refresh reuses the mirror's held view.
   * @returns nothing; the snapshot carries the outcome.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    let providers: ConfigurableProviderView[]
    let writable: boolean
    let views: readonly SettingsNamespaceView[]
    try {
      const [providersResponse] = await Promise.all([
        this.api.llm.providers({}),
        this.describeFace.ensure(),
      ])
      if (!providersResponse.result.ok) throw new Error(providersResponse.result.error.message)
      const mirrored = this.describeFace.getSnapshot()
      if (mirrored.view === undefined) {
        throw new Error(mirrored.error ?? 'settings are unavailable in this browser')
      }
      providers = providersResponse.result.value.providers
      writable = mirrored.view.writable
      views = mirrored.view.namespaces
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'error'
        s.error = error instanceof Error ? error.message : String(error)
      })
      return
    }
    const namespaces = new Map(views.map(view => [view.ns, view]))
    const rows: ProviderRow[] = providers.map((entry) => {
      const namespace = namespaces.get(entry.settingsNs)
      const configured = namespace !== undefined
        && (entry.settingsPath.length === 0 || this.schema.getPath(namespace.value, entry.settingsPath) !== undefined)
      const removable = namespace !== undefined
        && entry.settingsPath.length > 0
        && this.schema.hasPath(namespace.user, entry.settingsPath)
        && !this.schema.hasPath(namespace.base, entry.settingsPath)
      const apiKeyEnvs = credentialRefsOf(namespace, entry.settingsPath, this.schema)
      return {
        entry,
        configured,
        removable,
        apiKeyEnv: apiKeyEnvs[0],
        apiKeyEnvs,
        credential: undefined,
        credentials: {},
      }
    })
    const refs = [...new Set(rows.flatMap(row => [...row.apiKeyEnvs]))]
    let credentials: Record<string, CredentialView> = {}
    let credentialError: string | null = null
    if (refs.length > 0) {
      try {
        const response = await this.api.credentials.describe({ refs })
        // Credential state is an enrichment for the Models page: neither a
        // business rejection nor a transport failure fails the load. The
        // onboarding projection below retains the failure distinction.
        if (response.result.ok) credentials = response.result.value.credentials
        else credentialError = response.result.error.message
      } catch (error) {
        credentialError = messageOf(error)
      }
    }
    if (generation !== this.generation) return
    this.store.update((s) => {
      s.status = 'ready'
      s.error = null
      s.credentialError = credentialError
      s.writable = writable
      s.rows = rows.map((row) => {
        const held = Object.fromEntries(
          row.apiKeyEnvs.flatMap(ref => credentials[ref] === undefined ? [] : [[ref, credentials[ref]]]),
        )
        return {
          ...row,
          credentials: held,
          ...row.apiKeyEnv !== undefined && held[row.apiKeyEnv] !== undefined
            ? { credential: held[row.apiKeyEnv] }
            : {},
        }
      })
      s.namespaces = namespaces
    })
  }
}

/**
 * Whether a joined row can serve model requests as it stands: the route is
 * registered with the adapter registry, and whatever credential its resolved
 * profile names is stored. A profile naming no reference authenticates through
 * the provider's own path (the Bedrock chain, Vertex ADC, a gateway that needs
 * nothing), as does a live route with no settings address at all, so neither
 * owes this page a key.
 * @param row - one joined provider row.
 * @returns whether the user already has this provider to talk to.
 */
export function providerUsable(row: ProviderRow): boolean {
  if (!row.entry.active) return false
  if (row.apiKeyEnvs.length === 0) {
    // A composition-owned route with no named reference still needs a key
    // the Models page can store. Treating it as native-auth would hide the
    // FAC setup card behind a usable first-run posture.
    if (!row.removable && row.configured) return false
    return true
  }
  return row.apiKeyEnvs.every(ref => row.credentials[ref]?.configured === true)
}

/** First-run onboarding readiness derived only from the shared Models join. */
export type OnboardingReadiness =
  | { kind: 'loading' }
  | { kind: 'adapter-absent' }
  | { kind: 'provider-ready' }
  | { kind: 'credential-missing' }
  | {
    kind: 'unavailable'
    reason:
      | 'load-failed'
      | 'provider-inactive'
      | 'credentials-unavailable'
      | 'settings-read-only'
      | 'credential-read-only'
  }

/**
 * Project first-run readiness from the provider/settings/credential join used
 * by the Models page. The step exists to leave the user with a model to talk
 * to, so ANY usable provider ends it; only when none exists does the official
 * DeepSeek route — the one route the prompt can offer a key field for — decide
 * whether prompting can help. A missing official configurable-provider
 * declaration means the adapter is not repairable by navigating to Models.
 * @param state - current shared Models join snapshot.
 * @returns the onboarding state without reading a parallel fact source.
 */
export function onboardingReadiness(state: ModelsSettingsState): OnboardingReadiness {
  if ((state.status === 'idle' || state.status === 'loading') && state.rows.length === 0) {
    return { kind: 'loading' }
  }
  if (state.status === 'error') {
    return {
      kind: 'unavailable',
      reason: 'load-failed',
    }
  }
  if (state.rows.some(providerUsable)) return { kind: 'provider-ready' }
  const row = state.rows.find(candidate =>
    candidate.entry.provider === 'deepseek-official'
    && candidate.entry.settingsNs === 'llm-deepseek'
    && candidate.entry.settingsPath.length === 0)
  if (row === undefined) return { kind: 'adapter-absent' }
  if (!row.entry.active) {
    return {
      kind: 'unavailable',
      reason: 'provider-inactive',
    }
  }
  // Past the usable gate an active route names a reference it has no stored
  // credential for, so the remaining questions are all about that credential.
  if (state.credentialError !== null || row.credential === undefined) {
    return {
      kind: 'unavailable',
      reason: 'credentials-unavailable',
    }
  }
  if (!state.writable) {
    return {
      kind: 'unavailable',
      reason: 'settings-read-only',
    }
  }
  if (!row.credential.writable) {
    return {
      kind: 'unavailable',
      reason: 'credential-read-only',
    }
  }
  return { kind: 'credential-missing' }
}
