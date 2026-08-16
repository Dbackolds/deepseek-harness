/**
 * Plugins settings surface, browser half — one section whose feature-owned
 * tabs include configurable Host plugin cards and read-only inventory.
 *
 * The section declares `settings.plugins.tab`; its own `configurable` tab then
 * declares `settings.plugin.item` and renders whatever cards were registered
 * into it. The nav row sits at `priority: 1` so a marketplace that provides
 * `pluginMarketplaceUi` can occupy the same cell at the default priority.
 * The marketplace is recognized by its Loader entry name (client modules
 * do not export a Cordis `name`). While that fiber is present the shipped
 * `configurable` tab stays off, because it also declares `settings.plugin.item`.
 * The three cards this package ships are the host-plane sections the
 * deployment already exposes; each binds its namespace through the client
 * settings scope, which keeps them unaware of one another and of other tabs.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry)
// and the ctx.settingsScope Context merge. Cross-plugin collaboration goes
// through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the ctx.remote Context merge and the forwarded-event key face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { AgentLoopCard } from './AgentLoopCard.tsx'
import { BashCard } from './BashCard.tsx'
import { ConfigurablePluginsTab } from './ConfigurablePluginsTab.tsx'
import type { ConfigurablePluginsTabInjected } from './ConfigurablePluginsTab.tsx'
import { PluginsSettingsSection } from './PluginsSettingsSection.tsx'
import type { PluginsSettingsSectionInjected, PluginsSettingsTabEntry } from './PluginsSettingsSection.tsx'
import { WebSearchCard } from './WebSearchCard.tsx'
import { AGENT_LOOP_NS, AgentLoopCardController } from './agent-loop-card-controller.ts'
import { SHELL_NS, BashCardController } from './bash-card-controller.ts'
import { WEB_SEARCH_NS, WebSearchCardController } from './web-search-card-controller.ts'
import { en, zh } from './locales.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Present when an out-of-tree marketplace owns the Settings Plugins page.
     * The shipped section stays off that nav row so both halves do not occupy
     * `settings.section` id `plugins` at the same priority.
     */
    pluginMarketplaceUi?: true
  }
}

export type { PluginsSettingsSectionInjected, PluginsSettingsSectionProps } from './PluginsSettingsSection.tsx'
export type { ConfigurablePluginsTabInjected, ConfigurablePluginsTabProps } from './ConfigurablePluginsTab.tsx'
export type { PluginCardProps } from './PluginCard.tsx'
export type { SettingsPluginItemOwnerProps } from './slot-contract.ts'
export type { FieldProps } from './fields.tsx'
export type {
  CardActions, CardFieldSpec, CardFieldState, CardSecretSpec, CardShell,
} from './card-form.ts'
export type { AgentLoopCardFace, AgentLoopCardState } from './agent-loop-card-controller.ts'
export type { BashCardFace, BashCardState } from './bash-card-controller.ts'
export type { WebSearchCardFace, WebSearchCardState } from './web-search-card-controller.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.plugins'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Mount the plugin configuration section and the cards this package ships.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugins: section dictionaries')

  const bash = new BashCardController(ctx.settingsScope.bind({ namespace: SHELL_NS }))
  const agentLoop = new AgentLoopCardController(ctx.settingsScope.bind({ namespace: AGENT_LOOP_NS }))
  const webSearch = new WebSearchCardController(ctx.settingsScope.bind({ namespace: WEB_SEARCH_NS }), api)

  // The credential a card reports is not part of any settings section, so its
  // scope publishes nothing when one is written. This is the only signal that
  // a key written on another surface reached the Host.
  ctx.effect(
    () => ctx.remote.$on('credentials/updated', (ref) => { webSearch.refreshCredential(ref) }),
    'ui-settings-plugins: credential invalidations',
  )

  let tabsVersion = -1
  let tabsRevision = -1
  let tabs: readonly PluginsSettingsTabEntry[] = []
  const sectionInjected = (): PluginsSettingsSectionInjected => ({
    hooks: {
      tabs: {
        getSnapshot: () => {
          const version = ctx.slots.getVersion('settings.plugins.tab')
          const revision = ctx.locale.getSnapshot().revision
          if (version !== tabsVersion || revision !== tabsRevision) {
            tabsVersion = version
            tabsRevision = revision
            tabs = ctx.slots.entries('settings.plugins.tab')
              .map(entry => ({
                /* v8 ignore next -- list-slot registration requires id */
                id: entry.options.id ?? '',
                order: entry.options.order ?? 0,
                label: resolveSlotLabel(entry.options.label) ?? '',
              }))
              .sort((a, b) => a.order - b.order)
          }
          return tabs
        },
        subscribe: (listener) => {
          const offLedger = ctx.slots.subscribe('settings.plugins.tab', listener)
          const offLocale = ctx.locale.subscribe(listener)
          return () => {
            offLedger()
            offLocale()
          }
        },
      },
    },
  })

  // This package owns the one Plugins navigation entry and the tab chrome
  // unless a marketplace has claimed the page. The marketplace also
  // declares `settings.plugin.item`, so the shipped `configurable` tab
  // (which declares the same child) must stay off while that page is live.
  // The nav row still uses `priority: 1` so a marketplace that registers
  // the same cell at the default priority can shadow a row that mounted
  // first. Lowest priority renders.
  const MARKETPLACE_PLUGIN = '@starpivot/dsh-plugin-marketplace'
  // Dual-face client modules are `{ apply, inject }`. Cordis copies
  // `plugin.name` onto `runtime.name`, so the package id lives on the
  // Loader entry the boot graph already stamped (`fiber.entry.options.name`).
  const marketplaceEntryName = (fiber: object): string | undefined => {
    const named = fiber as { entry?: { options?: { name?: string } }; runtime?: { name?: string } }
    return named.entry?.options?.name ?? named.runtime?.name
  }
  const marketplaceOwnsPage = (): boolean => {
    if (ctx.get('pluginMarketplaceUi') !== undefined) return true
    for (const runtime of ctx.registry.values()) {
      if (runtime.name === MARKETPLACE_PLUGIN) return true
      for (const fiber of runtime.fibers) {
        if (marketplaceEntryName(fiber) === MARKETPLACE_PLUGIN) return true
      }
    }
    return false
  }
  const mountOfficialChrome = (): (() => void) => {
    const disposeSection = ctx.slots.inject('settings.section', () => {
      if (marketplaceOwnsPage()) return () => {}
      return ctx.slots.register({
        name: 'settings.section',
        id: 'plugins',
        order: 15,
        priority: 1,
        label: () => t('nav'),
        locale: NS,
        inject: sectionInjected,
        children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
      }, PluginsSettingsSection)
    })
    const disposeTab = ctx.slots.inject('settings.plugins.tab', () => {
      if (marketplaceOwnsPage()) return () => {}
      return ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'configurable',
        order: 0,
        label: () => t('configurableTab'),
        locale: NS,
        inject: (): ConfigurablePluginsTabInjected => ({
          cardCount: ctx.slots.entries('settings.plugin.item').length,
        }),
        children: { 'settings.plugin.item': { kind: 'list', scope: 'root' } },
      }, ConfigurablePluginsTab)
    })
    return () => {
      disposeTab()
      disposeSection()
    }
  }
  // The marketplace fiber is published on `internal/plugin` before its
  // `apply` runs. Tear the shipped chrome down in that listener so the
  // marketplace can declare `settings.plugin.item` without colliding.
  ctx.effect(() => {
    let disposeChrome = mountOfficialChrome()
    const off = ctx.on('internal/plugin', (fiber) => {
      if (!fiber.uid) return
      if (marketplaceEntryName(fiber) !== MARKETPLACE_PLUGIN) return
      disposeChrome()
      disposeChrome = mountOfficialChrome()
    })
    return () => {
      off()
      disposeChrome()
    }
  }, 'ui-settings-plugins: marketplace yield')

  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      id: 'bash',
      order: 0,
      locale: NS,
      inject: () => bash.inject(),
    }, BashCard)
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      id: 'agent-loop',
      order: 10,
      locale: NS,
      inject: () => agentLoop.inject(),
    }, AgentLoopCard)
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      id: 'web-search',
      order: 20,
      locale: NS,
      inject: () => webSearch.inject(),
    }, WebSearchCard)
  })
}
