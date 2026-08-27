/**
 * client-hmr, browser half: hot-reload driver for client plugin entries.
 *
 * Listens on the host's system SSE channel (`GET /plugins/events`); on a
 * `rebuilt` frame while auto-reload is on, or on a `reload` frame, it
 * reloads the entry's bundle and swaps the cordis fiber in place. Every graph entry is a plugin bundle
 * — `immediately` rows differ only in stage-one prefetch (a boot
 * optimization), so all rostered plugin packages share these reload semantics;
 * normal packages (react family, cordis, shell, pure libs) are not entries
 * and shell changes still mean a page reload. Cascade is zero-touch:
 * downstream fibers key their activation epoch on provider fiber uids
 * (vendor/cordis/src/fiber.ts `_refresh`), so replacing a provider fiber
 * re-cascades natively — reloading a data-layer plugin (connection/runtime)
 * cascades into its UI dependents with no HMR-side bookkeeping.
 *
 * Reload order (lazy CJS table): invalidate (drop the stale factory and
 * materialized record) → prefetch (load and register the fresh
 * factory) → registry-first teardown → drain old fiber unload → remove
 * owned `<style data-plugin>` tags → `entry.refresh()` materializes the new
 * factory. Invalidate MUST precede prefetch: a live factory makes prefetch
 * a no-op, and re-executing a bundle over an undeleted registration is a
 * loud duplicate. The swap is safe because execution is pure registration
 * under the lazy model — every module side effect (CSS injection included)
 * lives in the factory closure and runs at materialization, inside
 * refresh(). That also keeps the CSS ordering guarantee: owned styles are
 * removed after the old fiber's disposers drained (SlotCore one-owner
 * unregister) and before materialization re-injects tags under the same
 * stable tag ids.
 *
 * Failure window: if prefetch rejects after invalidate, the module is left
 * unregistered while the OLD fiber keeps running untouched (teardown never
 * started) — degraded but recoverable, the next rebuilt frame retries from
 * scratch. Consistent with the no-rollback policy below. Known dev-only
 * race: a rebuilt frame overlapping a still-in-flight boot arrival shares
 * that arrival's task and may materialize the pre-rebuild bytes; the next
 * rebuilt frame self-heals.
 *
 * Why not the naive `entry.fiber.dispose()` → `entry.refresh()` path:
 * 1. `Entry.fiber` is never cleared on dispose (vendor/loader/src/config/
 *    entry.ts assigns it only in `_init`), so `refresh()` hits its
 *    `if (this.fiber) return` guard and no-ops.
 * 2. A bare `fiber.dispose()` lands in Loader's self-dispose branch
 *    (vendor/loader/src/index.ts `internal/plugin` case 4: the registry
 *    still holds the runtime at emit time), which flags the entry
 *    `disabled: true` — permanently.
 * vendor/hmr's reload skeleton documents the fix: delete the runtime record
 * FIRST (`registry.delete` → case 4 returns early, the entry stays enabled),
 * then rebuild. `entry.fiber` is additionally cleared so
 * `entry.refresh()` re-imports and re-plugins through the Loader's own
 * `_init` (entry-resolved config, automatic `fiber.entry` rebinding) instead
 * of hand-rolling `registry.plugin`. Client entries have exactly one fiber
 * per runtime, so `registry.delete` never collaterally disposes siblings.
 *
 * Self-reload: this plugin is itself a graph entry, so a rebuilt frame may
 * name it. The in-flight reload keeps running in the old bundle's closure
 * (its EventSource closes with the old fiber's effects); the new bundle's
 * apply opens a fresh channel. Frames arriving during the gap are lost —
 * acceptable for the dev channel, the next rebuild renotifies.
 *
 * Failure policy: no rollback. An import failure leaves the entry
 * fiberless (the next rebuilt frame retries from scratch); an apply failure
 * leaves a FAILED fiber for the shell's status projection. Both log loudly.
 */
import type { Entry, Loader } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PluginsEventFrame } from '../events.ts'
import { EVENTS_ENDPOINT, RELOAD_ENDPOINT, parsePluginsEventFrame } from '../events.ts'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { ReloadRow, type ReloadRowInjected } from './ReloadRow.tsx'
import { en, zh, type HmrSettingsKey } from './locales.ts'
import { ClientHmrReloadPolicy } from './reload-policy.ts'
import { CLIENT_HMR_SETTINGS_NAMESPACE, type ClientHmrSettings } from '../hmr-settings.ts'

export type { PluginsEventFrame } from '../events.ts'
export { EVENTS_ENDPOINT, RELOAD_ENDPOINT } from '../events.ts'
export type { ReloadRowInjected, ReloadRowProps } from './ReloadRow.tsx'
export type { HmrSettingsKey } from './locales.ts'
export {
  AUTO_RELOAD_FIELD, CLIENT_HMR_SETTINGS_NAMESPACE, DEFAULT_AUTO_RELOAD,
  type ClientHmrSettings,
} from '../hmr-settings.ts'

/** Namespace owning this feature's settings-row copy. */
export const SETTINGS_NS = 'settings.hmr'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The plugin-reload settings row's copy. */
    'settings.hmr': HmrSettingsKey
  }
}

/** Cordis plugin name. */
export const name = 'client-hmr'

/**
 * Required services: the vendored Loader, the client module system, and the
 * settings/locale/slots seats for the General-section row. `remote` carries
 * the forwarded settings invalidation that `bindSettingsScope` subscribes to.
 */
export const inject = ['loader', 'modules', 'slots', 'locale', 'connection', 'remote', 'settingsScope']

/** Find the loader entry whose module specifier is `id` (entry tree ids are random; the package name lives in `options.name`). */
function findEntry(loader: Loader, id: string): Entry | undefined {
  for (const entry of loader.entries()) {
    if (entry.options.name === id) return entry
  }
  return undefined
}

/** Remove every `<style data-plugin>` tag owned by `id` (attribute compared verbatim — no CSS-selector escaping pitfalls). */
function removeOwnedStyles(id: string): void {
  for (const el of document.querySelectorAll('style[data-plugin]')) {
    if (el.getAttribute('data-plugin') === id) el.remove()
  }
}

/**
 * Mount the HMR driver: subscribe to the system SSE channel, hot-swap
 * rebuilt or manually requested entries, and register the General settings row.
 * @param ctx - plugin context with `loader`, `modules`, and settings seats.
 * @returns nothing; registrations live on the plugin fiber.
 */
export function apply(ctx: ClientContext): void {
  // Declared injections: `modules` from the client module loader, `loader`
  // from the vendored Loader, and the settings/locale/slots seats.
  const modLoader = ctx.modules
  const loader: Loader = ctx.loader
  const policy = new ClientHmrReloadPolicy(
    ctx.settingsScope.bind<ClientHmrSettings>({ namespace: CLIENT_HMR_SETTINGS_NAMESPACE }),
  )
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'client-hmr: settings row dictionaries')
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'plugin-reload',
    order: 30,
    locale: SETTINGS_NS,
    inject: (): ReloadRowInjected => ({
      hooks: { autoReload: policy.autoReload },
      setAutoReload: (enabled) => { policy.setAutoReload(enabled) },
      reloadPlugins: () => requestManualReload(),
    }),
  }, ReloadRow))

  async function reload(id: string, rev: string): Promise<void> {
    const entry = findEntry(loader, id)
    if (entry === undefined) {
      ctx.logger.warn(`client-hmr: rebuilt frame for unknown entry "${id}" (not in the loader tree)`)
      return
    }
    // Invalidate first (drop stale factory + record — a live factory makes
    // prefetch a no-op and re-registration a loud duplicate), then run the
    // async half while the old fiber still serves: script loading registers
    // the fresh factory with zero side effects (lazy CJS — module bodies run
    // at materialization, not execution).
    modLoader.invalidate(id, rev)
    await modLoader.prefetch(id)

    const oldFiber = entry.fiber
    if (oldFiber !== undefined) {
      // Registry-first teardown (see module comment): the runtime record must
      // be gone before the fiber's disposer emits internal/plugin, or the
      // Loader flags the entry disabled.
      const runtime = oldFiber.runtime
      if (runtime !== null) entry.ctx.registry.delete(runtime.callback)
      // Drain the unload: effect disposers (slots, subscriptions) must finish
      // before the new bundle executes and the new apply re-registers.
      while (oldFiber.inertia !== undefined) await oldFiber.inertia
      delete entry.fiber
    }
    // Old owned styles go before materialization re-injects them (the CSS
    // idempotency guard keys on stable tag ids).
    removeOwnedStyles(id)
    // Re-init through the entry: fiber cleared above, so refresh() re-imports
    // — materializing the prefetched factory (CSS injects here) — and
    // re-plugins under the entry context. Import failures are logged by
    // Entry._init and leave the entry fiberless (retryable).
    await entry.refresh()
    // Surface apply failures loudly (no rollback, FAILED state stays).
    await entry.fiber?.await()
  }

  // Serialize reloads: frames can arrive faster than a swap completes, and
  // interleaved dispose/execute chains would corrupt the single-slot handoff.
  let queue: Promise<void> = Promise.resolve()
  const handle = (frame: PluginsEventFrame): void => {
    switch (frame.type) {
      case 'rebuilt':
        queue = queue.then(() => reload(frame.id, frame.rev)).catch((error: unknown) => {
          ctx.logger.error(`client-hmr: reload of "${frame.id}" failed`)
          ctx.logger.error(error)
        })
        break
      case 'graph':
        // Connect-time snapshot, unused. Each rebuilt frame carries the
        // revision that selects the immutable single-resource combo script; the boot
        // graph remains the initial-load record until a page reload.
        break
      default:
        // Merge-extensible frame union: unknown frame types from newer hosts
        // are ignored by design.
        break
    }
  }

  ctx.effect(() => {
    const source = new EventSource(EVENTS_ENDPOINT)
    source.addEventListener('message', (event: MessageEvent<string>) => {
      let value: unknown
      try {
        value = JSON.parse(event.data) as unknown
      } catch {
        // Wire boundary: a malformed dev-channel frame is dropped loudly.
        ctx.logger.warn(`client-hmr: unparseable event frame: ${event.data}`)
        return
      }
      const parsed = parsePluginsEventFrame(value)
      if (parsed.kind === 'invalid') {
        ctx.logger.warn(`client-hmr: invalid event frame: ${event.data}`)
      } else if (parsed.kind === 'frame') {
        handle(parsed.frame)
      }
    })
    return () => { source.close() }
  }, 'client-hmr: event source')

  async function requestManualReload(): Promise<number> {
    const response = await fetch(RELOAD_ENDPOINT, { method: 'POST' })
    if (!response.ok) throw new Error(`client-hmr: manual reload failed with HTTP ${String(response.status)}`)
    const body = await response.json() as { ok?: boolean; reloaded?: number }
    if (body.ok !== true || typeof body.reloaded !== 'number') {
      throw new Error('client-hmr: manual reload returned an invalid body')
    }
    return body.reloaded
  }
}
