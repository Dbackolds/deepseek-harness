/** Client-plugin HMR preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the client-hmr plugin. */
export const CLIENT_HMR_SETTINGS_NAMESPACE = 'client-hmr'

/** Field that decides whether rebuilt bundles reload without a refresh. */
export const AUTO_RELOAD_FIELD = 'autoReload'

/** Default keeps automatic client-plugin reloads off after startup. */
export const DEFAULT_AUTO_RELOAD = false

/** Durable HMR section shared by the Host schema and the browser scope. */
export interface ClientHmrSettings {
  /** Whether a rebuilt client-plugin bundle reloads its fiber immediately. */
  autoReload: boolean
}

/** Durable HMR schema; also the wire envelope the browser scope validates against. */
export const ClientHmrSettingsSchema: z<ClientHmrSettings> = z.object({
  [AUTO_RELOAD_FIELD]: z.boolean().default(DEFAULT_AUTO_RELOAD),
})
