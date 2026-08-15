/**
 * Host Automation sidebar plugin, browser half: occupies `sidebar.automation`
 * with the trigger under New Session and a modal over the Host Automation
 * wire. The Host remains the fact source; this plugin holds no store beyond
 * the page snapshot and create-form draft.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { AutomationPage, AutomationPanel } from './AutomationPanel.tsx'
import type { AutomationPanelInjected } from './AutomationPanel.tsx'
import { AutomationStore, refreshIfLoaded } from './store.ts'
import { en, NS, zh, type AutomationKey } from './locales.ts'

export type { AutomationPageProps, AutomationPanelInjected, AutomationPanelProps } from './AutomationPanel.tsx'
export type { AutomationKey } from './locales.ts'
export type { AutomationCreateInput, AutomationRuleView, AutomationState } from './store.ts'
export { AutomationStore, refreshIfLoaded } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Host Automation sidebar copy. */
    automation: AutomationKey
  }
}

/** Required services for locale, the sidebar seat, and the Host wire. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the dictionaries and the sidebar Automation occupant.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-automation: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new AutomationStore(connection.api)
  const injected = (): AutomationPanelInjected => ({
    hooks: { automation: controller.store },
    load: () => controller.load(),
    create: input => controller.create(input),
    setEnabled: (id, enabled) => controller.setEnabled(id, enabled),
    runNow: id => controller.runNow(id),
    remove: id => controller.remove(id),
    setPageOpen: (open) => { controller.setPageOpen(open) },
  })

  ctx.effect(() => ctx.on('connection/reset', () => {
    refreshIfLoaded(controller)
  }), 'ui-automation: connection invalidations')

  ctx.slots.inject('sidebar.automation', () => ctx.slots.register({
    name: 'sidebar.automation',
    locale: NS,
    inject: injected,
  }, AutomationPanel))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'automation-page',
    locale: NS,
    inject: injected,
  }, AutomationPage))
}
