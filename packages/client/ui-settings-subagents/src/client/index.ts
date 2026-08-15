/**
 * Subagent settings surface, browser half — one section over the user
 * definition library stored in user-subagents.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { SubagentsSection } from './SubagentsSection.tsx'
import type { SubagentsSectionInjected } from './SubagentsSection.tsx'
import { en, zh, type SubagentsKey } from './locales.ts'
import { refreshIfLoaded, SubagentsStore, USER_SUBAGENTS_NS } from './store.ts'

export type { SubagentsSectionInjected, SubagentsSectionProps } from './SubagentsSection.tsx'
export type { SubagentsKey } from './locales.ts'
export type { DefinitionDraft, DefinitionRow, SubagentsState } from './store.ts'
export { USER_SUBAGENTS_NS, parseToolList, slugFromName } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Subagents settings page. */
    'settings.subagents': SubagentsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.subagents'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote']

/**
 * Register the Subagents section once settings.section is declared.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-subagents: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new SubagentsStore(connection.api)
  const t = ctx.locale.bind(NS)
  const injected = (): SubagentsSectionInjected => ({
    hooks: { subagents: controller.store },
    load: () => controller.load(),
    beginCreate: () => { controller.beginCreate() },
    beginEdit: (id: string) => { controller.beginEdit(id) },
    cancelDraft: () => { controller.cancelDraft() },
    setDraftName: (name: string) => { controller.setDraftName(name) },
    setDraftDescription: (description: string) => { controller.setDraftDescription(description) },
    setDraftPersona: (persona: string) => { controller.setDraftPersona(persona) },
    setDraftAllow: (allow: string) => { controller.setDraftAllow(allow) },
    setDraftDeny: (deny: string) => { controller.setDraftDeny(deny) },
    saveDraft: () => controller.saveDraft(),
    confirmDelete: (id: string | null) => { controller.confirmDelete(id) },
    remove: () => controller.remove(),
  })

  ctx.effect(() => {
    const refresh = (): void => { refreshIfLoaded(controller) }
    const disposers = [
      ctx.remote.$on('settings/document-updated', (ns) => {
        if (ns !== USER_SUBAGENTS_NS) return
        refresh()
      }),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-settings-subagents: pushed invalidations')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'subagents',
    order: 12,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, SubagentsSection))
}
