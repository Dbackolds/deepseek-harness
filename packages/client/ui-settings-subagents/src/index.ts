/**
 * Subagent settings surface, node half: Host registration for the delivery
 * section. The browser half ships the settings page through exports["./client"].
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  SUBAGENT_DELIVERY_SETTINGS_NAMESPACE, SubagentDeliverySettingsSchema,
} from './delivery-settings.ts'

export {
  DEFAULT_SUBAGENT_BUSY_DELIVERY, JOB_BUSY_FIELD, REPORT_BUSY_FIELD,
  SETTLEMENT_BUSY_FIELD, SUBAGENT_BUSY_DELIVERIES, SUBAGENT_DELIVERY_SETTINGS_NAMESPACE,
  SubagentDeliverySettingsSchema, type SubagentBusyDelivery, type SubagentDeliverySettings,
} from './delivery-settings.ts'

/**
 * Register the durable delivery section when a settings provider exists.
 * @param ctx - Host context whose optional settings service owns the section.
 * Omitted when the invariant companion probes the node half without a fiber.
 */
export function apply(ctx?: Context): void {
  ctx?.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(SUBAGENT_DELIVERY_SETTINGS_NAMESPACE),
      SubagentDeliverySettingsSchema,
    )
  })
}
