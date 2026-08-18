/**
 * General-settings row for the product-wide model-request retry budget and
 * stream-idle timeout. Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE,
  type LlmDefaultPolicySettings,
} from '@deepseek-ai/dsh-llm-default-policy/defaults'
import { LlmPolicyRow } from './LlmPolicyRow.tsx'
import type { LlmPolicyRowInjected } from './LlmPolicyRow.tsx'
import { LlmDefaultPolicyPreference } from './policy.ts'
import { en, zh, type LlmPolicySettingsKey } from './locales.ts'

export type { LlmPolicyRowInjected, LlmPolicyRowProps } from './LlmPolicyRow.tsx'
export type { LlmPolicySettingsKey } from './locales.ts'
export { LlmDefaultPolicyPreference } from './policy.ts'

/** Namespace owning this feature's settings-row copy. */
export const SETTINGS_NS = 'settings.llm-policy'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The product-wide retry and timeout settings row's copy. */
    'settings.llm-policy': LlmPolicySettingsKey
  }
}

/** Required services for the General-section row. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Register localized copy and the General settings row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const preference = new LlmDefaultPolicyPreference(
    ctx.settingsScope.bind<LlmDefaultPolicySettings>({
      namespace: LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE,
    }),
  )
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), 'ui-settings-llm-policy: dictionaries')
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'llm-policy',
    order: 15,
    locale: SETTINGS_NS,
    inject: (): LlmPolicyRowInjected => ({
      hooks: {
        maxRetries: preference.maxRetries,
        unlimited: preference.unlimited,
        streamIdleTimeoutMs: preference.streamIdleTimeoutMs,
      },
      setMaxRetries: (maxRetries) => { preference.setMaxRetries(maxRetries) },
      setUnlimited: (unlimited) => { preference.setUnlimited(unlimited) },
      setStreamIdleTimeoutMs: (streamIdleTimeoutMs) => {
        preference.setStreamIdleTimeoutMs(streamIdleTimeoutMs)
      },
    }),
  }, LlmPolicyRow))
}
