/**
 * HMR plugin, node half: the host end of the dev reload chain. One interval
 * stat-polls every graph row's client bundle (polling by design: network
 * mounts deliver no inotify events), reports content changes through
 * `clientModuleHost.rebuilt(id)`, and serves the `/plugins/events` SSE channel
 * broadcasting graph/rebuilt/reload frames to the browser half (src/client/).
 * The web bundle mounts this row unconditionally. Automatic rebuilt
 * broadcasts stay off until the Host `client-hmr.autoReload` setting is
 * true and a rebuild watcher rewrites client bundles; the poll still
 * tracks hashes so a manual reload can re-hash every watched row.
 */
import { statSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings/types'
import z from '@deepseek-ai/schemastery'
// Empty type imports carry the clientModuleHost/webServer Context merges.
import type {} from '@deepseek-ai/dsh-client-modules'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { PluginsEventFrame } from './events.ts'
import { EVENTS_ENDPOINT, RELOAD_ENDPOINT } from './events.ts'
import {
  CLIENT_HMR_SETTINGS_NAMESPACE, ClientHmrSettingsSchema, DEFAULT_AUTO_RELOAD,
  type ClientHmrSettings,
} from './hmr-settings.ts'

export type { PluginsEventFrame } from './events.ts'
export { EVENTS_ENDPOINT, RELOAD_ENDPOINT } from './events.ts'
export {
  AUTO_RELOAD_FIELD, CLIENT_HMR_SETTINGS_NAMESPACE, ClientHmrSettingsSchema,
  DEFAULT_AUTO_RELOAD, type ClientHmrSettings,
} from './hmr-settings.ts'

/** Cordis plugin name. */
export const name = 'client-hmr'

/** Required services: the web plugin table and the route registry. */
export const inject = ['clientModules', 'webServer']

const HMR_NAMESPACE = settingsNamespace(CLIENT_HMR_SETTINGS_NAMESPACE)

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Bundle stat-poll interval in milliseconds (default 500, the build-side watcher's polling default). */
  pollIntervalMs?: number
}

export const Config: z<Config> = z.object({
  pollIntervalMs: z.number().step(1).min(1).default(500),
})

/** Serialize one frame as an SSE data line. */
function sseData(frame: PluginsEventFrame): string {
  return `data: ${JSON.stringify(frame)}\n\n`
}

interface WatchedBundle {
  path: string
  mtimeMs: number
  size: number
  dirty: boolean
}

/**
 * Mount the dev chain: bundle watches, optional rebuilt broadcasts, the SSE
 * channel, and POST /plugins/reload.
 * @param ctx - host plugin context carrying clientModuleHost and webServer.
 * @param config - validated {@link Config}.
 * @returns nothing; watches, routes, and settings registration live on the fiber.
 */
export function apply(ctx: Context, config: Config): void {
  // schemastery's .default() guarantees the field is set after validation.
  const pollIntervalMs = config.pollIntervalMs as number
  let autoReload = DEFAULT_AUTO_RELOAD
  const adoptAutoReload = (): void => {
    const section = ctx.get('settings')?.get(HMR_NAMESPACE) as ClientHmrSettings | undefined
    autoReload = section?.autoReload ?? DEFAULT_AUTO_RELOAD
  }
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(HMR_NAMESPACE, ClientHmrSettingsSchema)
    adoptAutoReload()
    settingsCtx.on('settings/updated', (ns) => {
      if (ns === HMR_NAMESPACE) adoptAutoReload()
    })
  })

  // --- bundle watch: one HMR-owned stat poll ------------------------------
  const watched = new Map<string, WatchedBundle>()

  const rehash = (id: string, watch: WatchedBundle, current: { mtimeMs: number; size: number }): void => {
    try {
      // rebuilt() re-hashes; an unchanged hash stays silent (clientModuleHost
      // fires onRebuilt only on a real rev change).
      ctx.clientModules.rebuilt(id)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        watch.dirty = true
        return
      }
      ctx.logger.warn(error)
    }
    watch.mtimeMs = current.mtimeMs
    watch.size = current.size
    watch.dirty = false
  }

  const watchRow = (id: string, path: string): void => {
    let baseline: { mtimeMs: number; size: number }
    try {
      baseline = statSync(path)
    } catch (error) {
      watched.set(id, { path, mtimeMs: 0, size: 0, dirty: true })
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') ctx.logger.warn(error)
      return
    }
    const watch = { path, mtimeMs: baseline.mtimeMs, size: baseline.size, dirty: false }
    watched.set(id, watch)
    // The module host hashed before publishing the graph. Re-hash immediately
    // after capturing this baseline so a write in between cannot become an
    // already-current baseline paired with a stale graph rev.
    rehash(id, watch, baseline)
  }

  const pollWatches = (): void => {
    for (const [id, watch] of watched) {
      let current: { mtimeMs: number; size: number }
      try {
        current = statSync(watch.path)
      } catch (error) {
        watch.dirty = true
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') ctx.logger.warn(error)
        continue
      }
      if (!watch.dirty && current.mtimeMs === watch.mtimeMs && current.size === watch.size) continue
      // Stat-before-hash preserves a detectable older baseline for writes that
      // land during hashing. Repeated stat changes heal a torn read.
      rehash(id, watch, current)
    }
  }

  // Diff the watch set against the current graph: drop watches for removed
  // rows (or rows whose bundle path moved), add watches for new rows.
  const syncWatches = (): void => {
    const rows = new Map<string, string>()
    for (const row of ctx.clientModules.graph().entries) {
      const path = ctx.clientModules.clientPath(row.id)
      if (path !== undefined) rows.set(row.id, path)
    }
    for (const [id, watch] of watched) {
      if (rows.get(id) === watch.path) continue
      watched.delete(id)
    }
    for (const [id, path] of rows) {
      if (!watched.has(id)) watchRow(id, path)
    }
  }

  ctx.effect(() => {
    // Initial sync covers rows already in the graph; the subscription covers
    // rows arriving later (boot-window activations, including this plugin's
    // own row — no self-exemption, a modules/hmr rebuild rides the same chain).
    syncWatches()
    const unsubscribe = ctx.clientModules.onGraphChanged(syncWatches)
    const timer = setInterval(pollWatches, pollIntervalMs)
    timer.unref()
    return () => {
      unsubscribe()
      clearInterval(timer)
      watched.clear()
    }
  }, 'client-hmr: bundle watches')

  // --- /plugins/events SSE channel ----------------------------------------
  const connections = new Set<ServerResponse>()

  const connect = (res: ServerResponse): void => {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
    })
    // Comment line on open so clients/proxies see a live channel even when
    // no rebuild ever happens; EventSource frame parsing skips it naturally.
    res.write(': connected\n\n')
    res.write(sseData({ type: 'graph', graph: ctx.clientModules.graph() }))
    connections.add(res)
    res.on('close', () => { connections.delete(res) })
  }

  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register({
      kind: 'exact',
      path: EVENTS_ENDPOINT,
      handler: (req, res) => {
        // Named routes match ahead of the carrier's method gate; keep the old
        // global 405 semantics for non-GET hits on this endpoint.
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405)
          res.end()
          return
        }
        connect(res)
      },
    })
    const broadcast = (frame: PluginsEventFrame): void => {
      const line = sseData(frame)
      for (const res of connections) res.write(line)
    }
    const unsubscribe = ctx.clientModules.onRebuilt((id, rev) => {
      if (!autoReload) return
      broadcast({ type: 'rebuilt', id, rev })
    })
    const disposeReload = ctx.webServer.register({
      kind: 'exact',
      path: RELOAD_ENDPOINT,
      handler: (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405)
          res.end()
          return
        }
        const revs: { id: string; rev: string }[] = []
        for (const [id, watch] of watched) {
          let current: { mtimeMs: number; size: number }
          try {
            current = statSync(watch.path)
          } catch (error) {
            watch.dirty = true
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') ctx.logger.warn(error)
            continue
          }
          rehash(id, watch, current)
          const rev = ctx.clientModules.graph().entries.find(entry => entry.id === id)?.rev
          if (rev === undefined) continue
          revs.push({ id, rev })
        }
        for (const { id, rev } of revs) broadcast({ type: 'reload', id, rev })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, reloaded: revs.length }))
      },
    })
    return () => {
      unsubscribe()
      disposeReload()
      disposeRoute()
      for (const res of connections) res.destroy()
      connections.clear()
    }
  }, 'client-hmr: /plugins/events channel')
}
