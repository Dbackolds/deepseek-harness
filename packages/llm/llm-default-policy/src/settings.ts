/**
 * Product-wide default retry budget and stream-idle timeout stored in the
 * Host user-settings document.
 *
 * @module @deepseek-ai/dsh-llm-default-policy/settings
 */

import z from '@deepseek-ai/schemastery'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_UNLIMITED,
  MAX_RETRIES_FIELD,
  STREAM_IDLE_TIMEOUT_MS_FIELD,
  UNLIMITED_FIELD,
} from './defaults.ts'
import type { LlmDefaultPolicySettings } from './defaults.ts'

export {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_UNLIMITED,
  LLM_DEFAULT_POLICY_ENTRY,
  LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE,
  MAX_RETRIES_FIELD,
  STREAM_IDLE_TIMEOUT_MS_FIELD,
  UNLIMITED_FIELD,
} from './defaults.ts'
export type { LlmDefaultPolicySettings } from './defaults.ts'

/** Durable schema; also the wire envelope the browser scope validates against. */
export const LlmDefaultPolicySettingsSchema: z<LlmDefaultPolicySettings> = z.object({
  [MAX_RETRIES_FIELD]: z.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
  [UNLIMITED_FIELD]: z.boolean().default(DEFAULT_UNLIMITED),
  [STREAM_IDLE_TIMEOUT_MS_FIELD]: z.number()
    .min(Number.MIN_VALUE)
    .max(MAX_TIMER_DELAY_MS)
    .default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
})
