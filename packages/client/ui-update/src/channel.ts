/** Product update channel: CLI/web vs packaged desktop. */

/** Concrete release channels matched against GitHub tag prefixes. */
export const PRODUCT_CHANNELS = ['dsh', 'desktop'] as const

/** Plugin config values; `auto` defers to `DSH_PRODUCT_CHANNEL`. */
export const PRODUCT_CHANNEL_CONFIGS = ['auto', ...PRODUCT_CHANNELS] as const

/** Concrete release channel. */
export type ProductChannel = typeof PRODUCT_CHANNELS[number]

/** Plugin config: `auto` defers to `DSH_PRODUCT_CHANNEL`. */
export type ProductChannelConfig = typeof PRODUCT_CHANNEL_CONFIGS[number]

/** Default GitHub `owner/repo` for CLI/web (`dsh-v*`) releases. */
export const DEFAULT_DSH_UPDATE_REPO = 'deepseek-ai/deepseek-harness'

/** Default GitHub `owner/repo` for packaged desktop (`desktop-v*`) releases. */
export const DEFAULT_DESKTOP_UPDATE_REPO = 'StarPivotNet/deepseek-harness'

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
 * GitHub `owner/repo` polled when plugin config omits `repo`.
 *
 * Desktop tags live on the StarPivot feed; CLI tags live on the official
 * `deepseek-ai` feed. An explicit `repo` config still wins at the checker.
 *
 * @param channel - concrete channel.
 * @returns `owner/repo`.
 */
export function defaultUpdateRepo(channel: ProductChannel): string {
  return channel === 'desktop' ? DEFAULT_DESKTOP_UPDATE_REPO : DEFAULT_DSH_UPDATE_REPO
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
