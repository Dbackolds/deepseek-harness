/**
 * Session-history tools gate, browser half — one General-settings row bound
 * to the Host gate's `session-history-tools` namespace. The Host schema and
 * tool restrictions live on the host-side session-history-gate plugin; this
 * package only reads and writes the scope. Export discipline:
 * packages/client/AGENTS.md.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge ('settings.general.item') and
// the ctx.settingsScope Context merge. Cross-plugin collaboration goes through
// the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SessionHistoryGateRow } from './SessionHistoryGateRow.tsx'
import type { SessionHistoryGateRowInjected } from './SessionHistoryGateRow.tsx'
import { SESSION_HISTORY_TOOLS_NS, SessionHistoryGatePreference } from './preference.ts'
import type { SessionHistoryToolsSettings } from './preference.ts'
import { en, NS, zh, type SessionHistoryGateKey } from './locales.ts'

export type { SessionHistoryGateRowInjected, SessionHistoryGateRowProps } from './SessionHistoryGateRow.tsx'
export type { SessionHistoryGateKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The session-history tools gate row's copy. */
    'settings.session-history-gate': SessionHistoryGateKey
  }
}

/** Required services for the General-section row. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Register localized copy and the General settings row.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const preference = new SessionHistoryGatePreference(
    ctx.settingsScope.bind<SessionHistoryToolsSettings>({ namespace: SESSION_HISTORY_TOOLS_NS }),
  )
  ctx.effect(() => () => { preference.dispose() }, 'ui-session-history-gate: gate preference')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-history-gate: dictionaries')
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'session-history-tools',
    order: 16,
    locale: NS,
    inject: (): SessionHistoryGateRowInjected => ({
      hooks: {
        enabled: preference.enabled,
        writable: preference.writable,
        saving: preference.saving,
      },
      setEnabled: (enabled) => { preference.setEnabled(enabled) },
    }),
  }, SessionHistoryGateRow))
}
