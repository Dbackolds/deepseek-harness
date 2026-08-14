/**
 * automation domain zod schemas.
 */

import { z } from 'zod'
import type { Wire } from './rpc.schema.ts'
import type { AutomationRuleView, AutomationRunView, RequestPayload, ResponseValue } from './index.ts'

const localAtSchema = z.object({
  date: z.string(),
  time: z.string(),
  time_zone: z.string(),
})

const localClockSchema = z.object({
  time: z.string(),
  time_zone: z.string(),
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
})

const selectorFields = {
  afterSeconds: z.number().int().positive().optional(),
  at: z.union([z.string(), localAtSchema]).optional(),
  everySeconds: z.number().int().positive().optional(),
  localClock: localClockSchema.optional(),
}

const ruleViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  task: z.string(),
  workspaceId: z.string(),
  agentPreset: z.string().optional(),
  permissionPreset: z.string().optional(),
  onOverlap: z.enum(['skip', 'replace']),
  selector: z.unknown(),
  scheduledAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  state: z.enum(['scheduled', 'overdue', 'disabled']),
  nextAt: z.string(),
}) as unknown as z.ZodType<Wire<AutomationRuleView>>

const runViewSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  sessionId: z.string().optional(),
  startedAt: z.string(),
  outcome: z.enum(['started', 'skipped_busy', 'replaced', 'failed']),
  errorCode: z.string().optional(),
}) as unknown as z.ZodType<Wire<AutomationRunView>>

/** automation.list request payload. */
export const automationListRequestSchema = z.object({}) as unknown as z.ZodType<Wire<RequestPayload<'automation.list'>>>

/** automation.list response value. */
export const automationListValueSchema = z.object({
  items: z.array(ruleViewSchema),
}) as unknown as z.ZodType<Wire<ResponseValue<'automation.list'>>>

/** automation.create request payload. */
export const automationCreateRequestSchema = z.object({
  name: z.string().optional(),
  task: z.string().min(1),
  workspaceId: z.string().min(1),
  agentPreset: z.string().optional(),
  permissionPreset: z.string().optional(),
  onOverlap: z.enum(['skip', 'replace']).optional(),
  ...selectorFields,
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.create'>>>

/** automation.create response value. */
export const automationCreateValueSchema = z.object({
  rule: ruleViewSchema,
}) as unknown as z.ZodType<Wire<ResponseValue<'automation.create'>>>

/** automation.update request payload. */
export const automationUpdateRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  task: z.string().optional(),
  workspaceId: z.string().optional(),
  agentPreset: z.string().nullable().optional(),
  permissionPreset: z.string().nullable().optional(),
  onOverlap: z.enum(['skip', 'replace']).optional(),
  enabled: z.boolean().optional(),
  ...selectorFields,
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.update'>>>

/** automation.update response value. */
export const automationUpdateValueSchema = automationCreateValueSchema as unknown as z.ZodType<Wire<ResponseValue<'automation.update'>>>

/** automation.delete request payload. */
export const automationDeleteRequestSchema = z.object({
  id: z.string().min(1),
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.delete'>>>

/** automation.delete response value. */
export const automationDeleteValueSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
}) as unknown as z.ZodType<Wire<ResponseValue<'automation.delete'>>>

/** automation.setEnabled request payload. */
export const automationSetEnabledRequestSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.setEnabled'>>>

/** automation.setEnabled response value. */
export const automationSetEnabledValueSchema = automationCreateValueSchema as unknown as z.ZodType<Wire<ResponseValue<'automation.setEnabled'>>>

/** automation.runNow request payload. */
export const automationRunNowRequestSchema = z.object({
  id: z.string().min(1),
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.runNow'>>>

/** automation.runNow response value. */
export const automationRunNowValueSchema = z.object({
  run: runViewSchema,
}) as unknown as z.ZodType<Wire<ResponseValue<'automation.runNow'>>>

/** automation.listRuns request payload. */
export const automationListRunsRequestSchema = z.object({
  id: z.string().min(1),
  limit: z.number().int().positive().optional(),
}) as unknown as z.ZodType<Wire<RequestPayload<'automation.listRuns'>>>

/** automation.listRuns response value. */
export const automationListRunsValueSchema = z.object({
  items: z.array(runViewSchema),
}) as unknown as z.ZodType<Wire<ResponseValue<'automation.listRuns'>>>
