/**
 * skills domain contract: the composer's session-addressed menu plus the
 * Settings catalog. Session-addressed lookup never creates or resumes an
 * Agent. The Settings catalog is session-independent.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Skill catalog row (wire projection of the host SkillSummary; provider/source vocabulary stays host-side). */
export interface SkillEntry {
  /** Kebab-case identifier the user references as `/name` in the composer. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** False marks a user-only skill (`disable-model-invocation`): invocable here, absent from the model catalog. */
  readonly modelInvocable: boolean
}

/** Settings catalog row: every discovered skill, including invocation policy and origin. */
export interface SkillCatalogEntry extends SkillEntry {
  /** Whether a human-facing command catalog may advertise this skill. */
  readonly userInvocable: boolean
  /** Discovery source that produced this winning skill. */
  readonly source: string
  /** Provider that owns this skill body. */
  readonly provider: string
}

/**
 * Skill-domain unary methods (the map key skill.* of RpcMethodMap).
 * Invocation itself is a plain `session.prompt` whose leading `/name`
 * token the host recognizes at the pre-step boundary (`dsh-tool-skill`
 * injects the rendered body there), so every client shares one
 * deterministic path with no dedicated invocation wire.
 */
export interface SkillsApi {
  /** Lists the user-invocable skill catalog for the session's project. */
  list(request: RpcRequest<{ sessionId: SessionId }>): Promise<RpcResponse<{ skills: readonly SkillEntry[] }>>
  /**
   * Lists every discovered skill for Settings. Merges the host global layer
   * with the deployment default preset's standing layer at the gateway cwd.
   */
  catalog(request: RpcRequest<Record<string, never>>): Promise<RpcResponse<{ skills: readonly SkillCatalogEntry[] }>>
}
