/**
 * git domain zod schemas (names derived from map keys:
 * gitDescribeRequestSchema / gitDescribeValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { sessionIdSchema } from './sessions.schema.ts'
import type { GitBranchView, SessionGitView } from './git.ts'

/** GitBranchView row of git.describe. */
export const gitBranchViewSchema = z.object({
  name: z.string().min(1),
  current: z.boolean(),
  remote: z.boolean(),
}) satisfies z.ZodType<Wire<GitBranchView>>

/** SessionGitView of git.describe / git.checkout / git.createBranch. */
export const sessionGitViewSchema = z.object({
  currentBranch: z.string().min(1),
  worktreePath: z.string().min(1),
  isolated: z.boolean(),
  dirtyCount: z.number().int().nonnegative(),
  unpushedCount: z.number().int().nonnegative(),
  branches: z.array(gitBranchViewSchema),
}) satisfies z.ZodType<Wire<SessionGitView>>

/** git.describe request payload. */
export const gitDescribeRequestSchema = z.object({
  sessionId: sessionIdSchema.optional(),
  workspaceId: z.string().min(1).optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'git.describe'>>>

/** git.describe response value. */
export const gitDescribeValueSchema = sessionGitViewSchema satisfies z.ZodType<Wire<ResponseValue<'git.describe'>>>

/** git.checkout request payload. */
export const gitCheckoutRequestSchema = z.object({
  sessionId: sessionIdSchema,
  branch: z.string().min(1).max(255),
}) satisfies z.ZodType<Wire<RequestPayload<'git.checkout'>>>

/** git.checkout response value. */
export const gitCheckoutValueSchema = sessionGitViewSchema satisfies z.ZodType<Wire<ResponseValue<'git.checkout'>>>

/** git.createBranch request payload. */
export const gitCreateBranchRequestSchema = z.object({
  sessionId: sessionIdSchema,
  branch: z.string().min(1).max(255),
}) satisfies z.ZodType<Wire<RequestPayload<'git.createBranch'>>>

/** git.createBranch response value. */
export const gitCreateBranchValueSchema = sessionGitViewSchema satisfies z.ZodType<Wire<ResponseValue<'git.createBranch'>>>
