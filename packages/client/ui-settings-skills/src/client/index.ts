/**
 * Skills settings surface, browser half — one read-only catalog of every
 * discovered skill, including built-in providers.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { SkillsSection } from './SkillsSection.tsx'
import type { SkillsSectionInjected } from './SkillsSection.tsx'
import { en, zh, type SkillsSettingsKey } from './locales.ts'

export type { SkillsSectionInjected, SkillsSectionProps } from './SkillsSection.tsx'
export type { SkillsSettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Skills settings page. */
    'settings.skills': SkillsSettingsKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.skills'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the Skills section once `settings.section` is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skills: dictionaries')

  const { api } = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS)
  const list: SkillsSectionInjected['list'] = async () => {
    const { result } = await api.skills.catalog({})
    if (!result.ok) throw new Error(`skill.catalog failed: ${result.error.code}: ${result.error.message}`)
    return result.value.skills
  }
  const injected = (): SkillsSectionInjected => ({ list })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills',
    order: 17,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, SkillsSection))
}
