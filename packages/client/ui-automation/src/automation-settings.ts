/** Automation host-awake preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the Automation UI plugin. */
export const AUTOMATION_SETTINGS_NAMESPACE = 'ui-automation'

/** Field that decides whether a live Host may keep the machine from sleeping. */
export const KEEP_AWAKE_FIELD = 'keepAwake'

/** Default leaves sleep policy to the operating system. */
export const DEFAULT_KEEP_AWAKE = false

/** Durable Automation section shared by the Host schema and the browser scope. */
export interface AutomationSettings {
  /** Whether a live Host holds an OS sleep assertion. */
  keepAwake: boolean
}

/** Durable Automation schema; also the wire envelope the browser scope validates against. */
export const AutomationSettingsSchema: z<AutomationSettings> = z.object({
  [KEEP_AWAKE_FIELD]: z.boolean().default(DEFAULT_KEEP_AWAKE),
})
