/**
 * Host Automation sidebar plugin, browser half: occupies `sidebar.automation`
 * with the trigger under New Session and a modal over the Host Automation
 * wire. The Host remains the fact source; this plugin holds no store beyond
 * the page snapshot, the create-form draft, and the keep-awake preference.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AUTOMATION_SETTINGS_NAMESPACE, type AutomationSettings } from '../automation-settings.ts'
import { AutomationPage, AutomationPanel } from './AutomationPanel.tsx'
import type { AutomationPanelInjected } from './AutomationPanel.tsx'
import { AutomationKeepAwakePolicy } from './keep-awake-policy.ts'
import { AutomationStore, refreshIfLoaded } from './store.ts'
import { en, NS, zh, type AutomationKey } from './locales.ts'

export type { AutomationPageProps, AutomationPanelInjected, AutomationPanelProps } from './AutomationPanel.tsx'
export type { AutomationKey } from './locales.ts'
export type {
  AutomationCreateInput, AutomationDetailTab, AutomationListedRule, AutomationRuleView,
  AutomationRunView, AutomationState, AutomationUpdateInput,
} from './store.ts'
export { AutomationStore, refreshIfLoaded } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Host Automation sidebar copy. */
    automation: AutomationKey
  }
}

/** Required services for locale, the sidebar seat, the Host wire, sessions, and settings. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'sessions', 'settingsScope']

/**
 * Register the dictionaries and the sidebar Automation occupant.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-automation: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new AutomationStore(connection.api, ctx.sessions)
  const keepAwake = new AutomationKeepAwakePolicy(
    ctx.settingsScope.bind<AutomationSettings>({ namespace: AUTOMATION_SETTINGS_NAMESPACE }),
  )
  const injected = (): AutomationPanelInjected => ({
    hooks: { automation: controller.store, keepAwake: keepAwake.keepAwake },
    load: () => controller.load(),
    create: input => controller.create(input),
    update: (id, input) => controller.update(id, input),
    setEnabled: (id, enabled) => controller.setEnabled(id, enabled),
    runNow: id => controller.runNow(id),
    openLastSession: id => controller.openLastSession(id),
    openRun: sessionId => controller.openRun(sessionId),
    deleteRun: id => controller.deleteRun(id),
    remove: id => controller.remove(id),
    select: (id) => { controller.select(id) },
    setDetailTab: (tab) => { controller.setDetailTab(tab) },
    setPageOpen: (open) => { controller.setPageOpen(open) },
    setKeepAwake: (enabled) => { keepAwake.setKeepAwake(enabled) },
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
