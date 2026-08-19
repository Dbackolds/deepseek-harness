/** Busy-state notice placement stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the Subagents settings plugin. */
export const SUBAGENT_DELIVERY_SETTINGS_NAMESPACE = 'subagent-delivery'

/** Busy placement for a continuable child's settlement notice. */
export const SETTLEMENT_BUSY_FIELD = 'settlementBusy'

/** Busy placement for a continuable child's explicit report. */
export const REPORT_BUSY_FIELD = 'reportBusy'

/** Busy placement for a parent-owned Job completion notice. */
export const JOB_BUSY_FIELD = 'jobBusy'

/** Busy-state inbox placements accepted at settings and send boundaries. */
export const SUBAGENT_BUSY_DELIVERIES = ['queue', 'steer'] as const

/** Configurable busy-state inbox target for one notice channel. */
export type SubagentBusyDelivery = typeof SUBAGENT_BUSY_DELIVERIES[number]

/** Default admits the notice at the nearest later step. */
export const DEFAULT_SUBAGENT_BUSY_DELIVERY: SubagentBusyDelivery = 'steer'

/** Durable delivery section shared by the Host schema and the browser scope. */
export interface SubagentDeliverySettings {
  /** Busy placement for a settlement notice. */
  settlementBusy: SubagentBusyDelivery
  /** Busy placement for a child report. */
  reportBusy: SubagentBusyDelivery
  /** Busy placement for a Job completion notice. */
  jobBusy: SubagentBusyDelivery
}

const BusyDeliverySchema = z.union([...SUBAGENT_BUSY_DELIVERIES]).default(DEFAULT_SUBAGENT_BUSY_DELIVERY)

/** Durable delivery schema; also the wire envelope the browser scope validates against. */
export const SubagentDeliverySettingsSchema: z<SubagentDeliverySettings> = z.object({
  [SETTLEMENT_BUSY_FIELD]: BusyDeliverySchema,
  [REPORT_BUSY_FIELD]: BusyDeliverySchema,
  [JOB_BUSY_FIELD]: BusyDeliverySchema,
})
