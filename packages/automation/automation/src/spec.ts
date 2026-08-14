/**
 * Durable Automation domain: rule and run tables plus the unused-id set.
 * @module @deepseek-ai/dsh-automation/src/spec
 */
import { z } from 'zod'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type {
  AutomationRuleId,
  AutomationRuleRecord,
  AutomationRunId,
  AutomationRunRecord,
} from './types.ts'

const ruleId = z.string().min(1).transform(value => value as AutomationRuleId)
const runId = z.string().min(1).transform(value => value as AutomationRunId)
const workspaceId = z.string().min(1).transform(value => value as import('@deepseek-ai/dsh-workspace').WorkspaceId)
const utcInstant = z.string().regex(/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/)
const afterSelector = z.object({
  kind: z.literal('after'),
  afterSeconds: z.number().int().positive(),
})
const atSelector = z.object({
  kind: z.literal('at'),
})
const everySelector = z.object({
  kind: z.literal('every'),
  everySeconds: z.number().int().min(300),
})
const localClockSelector = z.object({
  kind: z.literal('local-clock'),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  timeZone: z.string().min(1),
})
/** Durable shape of one Automation rule. */
export const automationRuleRecord = z.object({
  id: ruleId,
  name: z.string().min(1),
  enabled: z.boolean(),
  task: z.string().min(1),
  workspaceId,
  agentPreset: z.string().min(1).optional(),
  permissionPreset: z.string().min(1).optional(),
  onOverlap: z.enum(['skip', 'replace']),
  selector: z.discriminatedUnion('kind', [afterSelector, atSelector, everySelector, localClockSelector]),
  scheduledAt: utcInstant,
  createdAt: utcInstant,
  updatedAt: utcInstant,
})
/** Durable shape of one Automation run. */
export const automationRunRecord = z.object({
  id: runId,
  ruleId,
  sessionId: z.string().min(1).transform(SessionId).optional(),
  startedAt: utcInstant,
  outcome: z.enum(['started', 'skipped_busy', 'replaced', 'failed']),
  errorCode: z.string().min(1).optional(),
})
/** Unused-id ledger so delete cannot recycle a rule or run id. */
export const automationDomainState = z.object({
  usedRuleIds: z.array(ruleId),
  usedRunIds: z.array(runId),
})
/** Domain spec opened through `ctx.storage.domain`. */
export const automationDomainSpec = defineDomain({
  name: 'automation',
  version: 1,
  global: {
    schema: automationDomainState,
    initial: { usedRuleIds: [], usedRunIds: [] },
  },
  tables: {
    rules: domainTable<AutomationRuleId, AutomationRuleRecord>(
      automationRuleRecord as unknown as z.ZodType<AutomationRuleRecord>,
    ),
    runs: domainTable<AutomationRunId, AutomationRunRecord>(
      automationRunRecord as unknown as z.ZodType<AutomationRunRecord>,
    ),
  },
})

/** One stored rule; the public record is the durable medium shape. */
export type StoredAutomationRule = AutomationRuleRecord
/** One stored run; the public record is the durable medium shape. */
export type StoredAutomationRun = AutomationRunRecord
/** Durable unused-id ledger inferred from {@link automationDomainState}. */
export type AutomationDomainState = z.infer<typeof automationDomainState>
