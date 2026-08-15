/**
 * systemPrompt domain zod schemas (names derived from map keys:
 * systemPromptListRequestSchema / systemPromptListValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { RegisteredPromptSectionView } from './system-prompt.ts'

/** RegisteredPromptSectionView row of systemPrompt.list. */
export const registeredPromptSectionViewSchema = z.object({
  name: z.string().min(1),
  order: z.number(),
  text: z.string(),
  complete: z.boolean(),
}) satisfies z.ZodType<Wire<RegisteredPromptSectionView>>

/** systemPrompt.list request payload. */
export const systemPromptListRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'systemPrompt.list'>>>

/** systemPrompt.list response value. */
export const systemPromptListValueSchema = z.object({
  sections: z.array(registeredPromptSectionViewSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'systemPrompt.list'>>>
