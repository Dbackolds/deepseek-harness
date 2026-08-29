/**
 * Host half of product update: GitHub Releases poller, settings cache, and
 * the `/product-update` RPC channel the browser half calls.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-settings/types'
import z from '@deepseek-ai/schemastery'
import {
  checkProductUpdate,
  DEFAULT_CHECK_INTERVAL_MS,
  DEFAULT_UPDATE_REPO,
  type ProductUpdateCheckerOptions,
} from './checker.ts'
import { handleProductUpdateRpc } from './rpc.ts'
import { PRODUCT_UPDATE_RPC_CHANNEL } from './rpc-channel.ts'
import {
  PRODUCT_UPDATE_SETTINGS_NAMESPACE,
  ProductUpdateSettingsSchema,
  type ProductUpdateSettings,
} from './update-settings.ts'
import { PRODUCT_CHANNEL_CONFIGS, type ProductChannelConfig } from './channel.ts'

export {
  PRODUCT_UPDATE_SETTINGS_NAMESPACE,
  ProductUpdateSettingsSchema,
  type ProductCheckResult,
  type ProductUpdateSettings,
} from './update-settings.ts'
export { PRODUCT_UPDATE_RPC_CHANNEL } from './rpc-channel.ts'
export {
  DEFAULT_CHECK_INTERVAL_MS,
  DEFAULT_UPDATE_REPO,
  DEFAULT_FETCH_TIMEOUT_MS,
} from './checker.ts'
export {
  PRODUCT_CHANNELS,
  PRODUCT_CHANNEL_CONFIGS,
  resolveProductChannel,
  releaseTagPrefix,
  type ProductChannel,
  type ProductChannelConfig,
} from './channel.ts'

/** Cordis plugin name. */
export const name = 'client-ui-update'

export const inject = ['connection', 'settings'] as const

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** GitHub `owner/repo` whose Releases feed is polled. */
  repo?: string
  /** Release channel; `auto` reads `DSH_PRODUCT_CHANNEL`. */
  channel?: ProductChannelConfig
  /** Gap between GitHub polls in milliseconds. */
  checkIntervalMs?: number
}

export const Config: z<Config> = z.object({
  repo: z.string().default(DEFAULT_UPDATE_REPO),
  channel: z.union([...PRODUCT_CHANNEL_CONFIGS]).default('auto'),
  checkIntervalMs: z.number().step(1).min(60_000).default(DEFAULT_CHECK_INTERVAL_MS),
})

/**
 * Register the durable cache, the loopback RPC channel, and the 24h poll.
 *
 * @param ctx - Host plugin context carrying connection and settings.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const ns = settingsNamespace(PRODUCT_UPDATE_SETTINGS_NAMESPACE)
  ctx.settings.register(ns, ProductUpdateSettingsSchema)
  // schemastery's .default() guarantees these fields after validation.
  const repo = config.repo as string
  const channel = config.channel as ProductChannelConfig
  const checkIntervalMs = config.checkIntervalMs as number
  const options = (): ProductUpdateCheckerOptions => ({
    repo,
    channel,
    intervalMs: checkIntervalMs,
    readSettings: () => ctx.settings.get(ns) as ProductUpdateSettings,
    writeSettings: next => ctx.settings.update(ns, next),
  })
  const warn = (error: unknown): void => {
    ctx.logger.warn(error)
  }
  const poll = (): void => {
    void checkProductUpdate(options()).catch(warn)
  }
  const connection = ctx.get('connection') as {
    rpc: {
      handle: (
        channel: string,
        handler: (endpoint: string, payload: unknown) => Promise<unknown>,
        options: { authority: 'loopback' },
      ) => () => Promise<void>
    }
  }
  ctx.effect(() => connection.rpc.handle(PRODUCT_UPDATE_RPC_CHANNEL, (endpoint, payload) => (
    handleProductUpdateRpc(endpoint, payload, options())
  ), { authority: 'loopback' }), 'product-update: rpc')
  ctx.effect(() => {
    poll()
    const timer = setInterval(poll, checkIntervalMs)
    return () => { clearInterval(timer) }
  }, 'product-update: poll')
}
