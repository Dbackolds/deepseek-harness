/** Product update channel: CLI/web vs packaged desktop. */

/** Concrete release channels matched against GitHub tag prefixes. */
export const PRODUCT_CHANNELS = ['dsh', 'desktop'] as const

/** Plugin config values; `auto` defers to `DSH_PRODUCT_CHANNEL`. */
export const PRODUCT_CHANNEL_CONFIGS = ['auto', ...PRODUCT_CHANNELS] as const

/** Concrete release channel. */
export type ProductChannel = typeof PRODUCT_CHANNELS[number]

/** Plugin config: `auto` defers to `DSH_PRODUCT_CHANNEL`. */
export type ProductChannelConfig = typeof PRODUCT_CHANNEL_CONFIGS[number]

/**
 * Resolve the concrete channel used to pick a GitHub tag prefix.
 *
 * An explicit `dsh` or `desktop` config wins. `auto` (the default) reads
 * `DSH_PRODUCT_CHANNEL` and treats any value other than `desktop` as `dsh`.
 *
 * @param configured - plugin config channel.
 * @param env - process environment.
 * @returns the concrete channel.
 */
export function resolveProductChannel(
  configured: ProductChannelConfig,
  env: NodeJS.ProcessEnv = process.env,
): ProductChannel {
  if (configured !== 'auto') return configured
  return env.DSH_PRODUCT_CHANNEL === 'desktop' ? 'desktop' : 'dsh'
}

/**
 * GitHub release tag prefix for a channel.
 *
 * @param channel - concrete channel.
 * @returns `desktop-v` or `dsh-v`.
 */
export function releaseTagPrefix(channel: ProductChannel): string {
  return channel === 'desktop' ? 'desktop-v' : 'dsh-v'
}
