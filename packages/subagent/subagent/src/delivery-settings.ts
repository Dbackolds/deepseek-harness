/**
 * Send-time reader for Host `subagent-delivery` busy-state placement.
 * The settings plugin registers the section; this package only reads it.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Host namespace registered by the Subagents settings plugin. */
export const SUBAGENT_DELIVERY_SETTINGS_NAMESPACE = settingsNamespace('subagent-delivery')

/** Busy-state inbox placements this reader accepts. */
export type SubagentBusyDelivery = 'steer' | 'queue'

/**
 * Read one busy-state field from Host settings at send time.
 * Missing settings, an unregistered section, or any value other than `queue`
 * is `steer`, including benches that never load a settings provider.
 * @param ctx - plugin context that may carry `settings`.
 * @param field - settlement or report channel.
 * @returns `queue` only when that field is stored; `steer` otherwise.
 */
export function readBusyDelivery(
  ctx: Context,
  field: 'settlementBusy' | 'reportBusy',
): SubagentBusyDelivery {
  const section = ctx.get('settings')?.get(SUBAGENT_DELIVERY_SETTINGS_NAMESPACE) as
    | { settlementBusy?: unknown; reportBusy?: unknown }
    | undefined
  return section?.[field] === 'queue' ? 'queue' : 'steer'
}
