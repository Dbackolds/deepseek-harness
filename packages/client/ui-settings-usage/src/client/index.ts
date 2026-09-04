/**
 * Usage settings surface, browser half.
 */
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { UsageSection } from './UsageSection.tsx'
import type { UsageSectionInjected } from './UsageSection.tsx'
import { en, zh, type UsageSettingsKey } from './locales.ts'
export type { UsageSectionInjected, UsageSectionProps } from './UsageSection.tsx'
export type { UsageSettingsKey } from './locales.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.usage': UsageSettingsKey
  }
}
/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.usage'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'remote.usage']

/**
 * Register the Usage section once `settings.section` is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-usage: dictionaries')
  const api = ctx.remote
  const t = ctx.locale.bind(NS)
  const load: UsageSectionInjected['load'] = async (timeZone) => {
    const result = await api.usage.overview({ timeZone })
    if (!result.ok) throw new Error('usage.overview failed: ' + result.error.code + ': ' + result.error.message)
    return result.value
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 35,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ load }),
  }, UsageSection))
}
