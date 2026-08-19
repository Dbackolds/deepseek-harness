/**
 * automation domain contract. Method signatures are the source of truth:
 * unary methods take the RpcRequest<P> narrow form and the impl echoes rpcId.
 */

import type { Branded } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from './workspace.ts'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Identifies one Host Automation rule. */
export type AutomationRuleId = Branded<'AutomationRuleId'>

/** Identifies one Host Automation run. */
export type AutomationRunId = Branded<'AutomationRunId'>

/** Structured local-calendar input accepted by create/update `at`. */
export interface AutomationLocalAtInput {
  readonly date: string
  readonly time: string
  readonly time_zone: string
}

/** Local-clock input accepted by create/update. */
export interface AutomationLocalClockInput {
  readonly time: string
  readonly weekdays?: readonly number[]
  readonly time_zone: string
}

/** Wire view of one Automation rule. */
export interface AutomationRuleView {
  readonly id: AutomationRuleId
  readonly name: string
  readonly enabled: boolean
  readonly task: string
  readonly workspaceId: WorkspaceId
  readonly agentPreset?: string
  readonly permissionPreset?: string
  readonly onOverlap: 'skip' | 'replace'
  readonly selector: unknown
  readonly scheduledAt: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly state: 'scheduled' | 'overdue' | 'disabled'
  readonly nextAt: string
}

/** Wire view of one Automation run. */
export interface AutomationRunView {
  readonly id: AutomationRunId
  readonly ruleId: AutomationRuleId
  readonly sessionId?: SessionId
  readonly startedAt: string
  readonly endedAt?: string
  readonly outcome: 'started' | 'skipped_busy' | 'replaced' | 'failed'
  readonly source?: 'schedule' | 'manual'
  readonly errorCode?: string
}

/** Shared create/update selector fields; exactly one selector is required on create. */
export interface AutomationSelectorFields {
  readonly afterSeconds?: number
  readonly at?: string | AutomationLocalAtInput
  readonly everySeconds?: number
  readonly localClock?: AutomationLocalClockInput
}

/** Automation-domain unary methods (the map keys automation.* of RpcMethodMap). */
export interface AutomationApi {
  /** Lists every rule in creation order. */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ items: AutomationRuleView[] }>>

  /** Creates one enabled rule. Exactly one selector field is required. */
  create(request: RpcRequest<{
    name?: string
    task: string
    workspaceId: WorkspaceId
    agentPreset?: string
    permissionPreset?: string
    onOverlap?: 'skip' | 'replace'
  } & AutomationSelectorFields>): Promise<RpcResponse<{ rule: AutomationRuleView }>>

  /** Applies a sparse patch. Changing the schedule still requires exactly one selector. */
  update(request: RpcRequest<{
    id: AutomationRuleId
    name?: string
    task?: string
    workspaceId?: WorkspaceId
    agentPreset?: string | null
    permissionPreset?: string | null
    onOverlap?: 'skip' | 'replace'
    enabled?: boolean
  } & AutomationSelectorFields>): Promise<RpcResponse<{ rule: AutomationRuleView }>>

  /** Deletes one rule. Past runs remain. */
  delete(request: RpcRequest<{ id: AutomationRuleId }>): Promise<RpcResponse<{ id: AutomationRuleId; deleted: boolean }>>

  /** Enables or disables one rule. */
  setEnabled(request: RpcRequest<{ id: AutomationRuleId; enabled: boolean }>):
  Promise<RpcResponse<{ rule: AutomationRuleView }>>

  /** Fires one rule immediately without moving its next target. */
  runNow(request: RpcRequest<{ id: AutomationRuleId }>): Promise<RpcResponse<{ run: AutomationRunView }>>

  /** Recent runs for one rule, newest first. */
  listRuns(request: RpcRequest<{ id: AutomationRuleId; limit?: number }>):
  Promise<RpcResponse<{ items: AutomationRunView[] }>>

  /** Deletes one past run. The run id is never reused. */
  deleteRun(request: RpcRequest<{ id: AutomationRunId }>):
  Promise<RpcResponse<{ id: AutomationRunId; deleted: boolean }>>
}
