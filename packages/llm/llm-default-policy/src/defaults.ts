/**
 * Product-wide default retry budget and stream-idle timeout constants.
 * Shared by the Host schema and the browser settings row without loading
 * the schema runtime.
 *
 * @module @deepseek-ai/dsh-llm-default-policy/defaults
 */

/** Settings namespace owned by the default model-request policy. */
export const LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE = 'llm-default-policy'

/** Field carrying the finite retry budget after the first request. */
export const MAX_RETRIES_FIELD = 'maxRetries'

/** Field that selects unbounded retry of every model-request failure. */
export const UNLIMITED_FIELD = 'unlimited'

/** Field carrying the default outstanding-read idle interval. */
export const STREAM_IDLE_TIMEOUT_MS_FIELD = 'streamIdleTimeoutMs'

/** Default finite retries after the first request when unlimited is off. */
export const DEFAULT_MAX_RETRIES = 5

/** Default keeps unbounded retry off. */
export const DEFAULT_UNLIMITED = false

/** Default outstanding-read idle interval in milliseconds (five minutes). */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/** Durable default-policy section shared by the Host schema and the browser scope. */
export interface LlmDefaultPolicySettings {
  /** Maximum eligible retries after the first request when unlimited is off. */
  maxRetries: number
  /** Whether every model-request failure retries until success or cancellation. */
  unlimited: boolean
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs: number
}

/** Composition defaults used as the settings-section base layer. */
export const LLM_DEFAULT_POLICY_ENTRY: LlmDefaultPolicySettings = {
  maxRetries: DEFAULT_MAX_RETRIES,
  unlimited: DEFAULT_UNLIMITED,
  streamIdleTimeoutMs: DEFAULT_STREAM_IDLE_TIMEOUT_MS,
}
