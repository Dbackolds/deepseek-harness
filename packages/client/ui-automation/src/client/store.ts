/**
 * Host Automation page store: the Host remains the single fact source.
 * Every mutation writes through the wire and the page re-renders from the
 * next list, pushed or refetched.
 */

import type { IApiClient, RpcResponse } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Wire view of one Automation rule, as the list RPC returns it. */
export type AutomationRuleView = Awaited<
  ReturnType<IApiClient['automation']['list']>
> extends RpcResponse<infer Value>
  ? Value extends { items: readonly (infer Item)[] } ? Item : never
  : never

/** Create payload accepted by the Host Automation wire. */
export type AutomationCreateInput = Parameters<IApiClient['automation']['create']>[0]

/** Page snapshot. */
export interface AutomationState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Whole-load failure text; row-level write failures stay on the row. */
  error: string | null
  items: readonly AutomationRuleView[]
}

/**
 * Human text for a rejected wire call.
 * @param error - the rejection value.
 * @returns the message to show.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Unwrap a unary response into its value or throw the Host error message.
 * @param response - the unary response.
 * @returns the success value.
 */
function valueOf<T>(response: RpcResponse<T>): T {
  if (!response.result.ok) throw new Error(response.result.error.message)
  return response.result.value
}

/** Host Automation list and mutation owner. */
export class AutomationStore {
  /** UI-facing immutable projection. */
  readonly store: SnapshotStore<AutomationState> = createSnapshotStore<AutomationState>({
    status: 'idle',
    error: null,
    items: [],
  })

  /**
   * @param api - automation wire face.
   */
  constructor(private readonly api: Pick<IApiClient, 'automation'>) {}

  /**
   * Fetch every rule. A failed reload keeps the last good list when one exists.
   * @returns once the snapshot has the new status.
   */
  async load(): Promise<void> {
    const previous = this.store.getSnapshot()
    this.store.update((draft) => {
      draft.status = previous.items.length === 0 ? 'loading' : previous.status
      draft.error = null
    })
    try {
      const value = valueOf(await this.api.automation.list({}))
      this.store.set({ status: 'ready', error: null, items: value.items })
    } catch (error) {
      this.store.update((draft) => {
        draft.status = previous.items.length === 0 ? 'error' : 'ready'
        draft.error = messageOf(error)
      })
    }
  }

  /**
   * Create one enabled rule and refresh the list.
   * @param input - create payload; exactly one selector field.
   * @returns the failure message, or undefined once the write and reload landed.
   */
  async create(input: AutomationCreateInput): Promise<string | undefined> {
    try {
      valueOf(await this.api.automation.create(input))
    } catch (error) {
      return messageOf(error)
    }
    await this.load()
    return this.store.getSnapshot().error ?? undefined
  }

  /**
   * Enable or disable one rule and refresh the list.
   * @param id - existing rule.
   * @param enabled - next armed state.
   * @returns the failure message, or undefined once the write and reload landed.
   */
  async setEnabled(id: AutomationRuleView['id'], enabled: boolean): Promise<string | undefined> {
    try {
      valueOf(await this.api.automation.setEnabled({ id, enabled }))
    } catch (error) {
      return messageOf(error)
    }
    await this.load()
    return this.store.getSnapshot().error ?? undefined
  }

  /**
   * Fire one rule immediately without moving its next target.
   * @param id - existing rule.
   * @returns the failure message, or undefined once the write landed.
   */
  async runNow(id: AutomationRuleView['id']): Promise<string | undefined> {
    try {
      valueOf(await this.api.automation.runNow({ id }))
    } catch (error) {
      return messageOf(error)
    }
    return undefined
  }

  /**
   * Delete one rule and refresh the list.
   * @param id - existing rule.
   * @returns the failure message, or undefined once the write and reload landed.
   */
  async remove(id: AutomationRuleView['id']): Promise<string | undefined> {
    try {
      valueOf(await this.api.automation.delete({ id }))
    } catch (error) {
      return messageOf(error)
    }
    await this.load()
    return this.store.getSnapshot().error ?? undefined
  }
}

/**
 * Refetch the page snapshot only after its first load.
 * @param controller - the page store.
 */
export function refreshIfLoaded(controller: AutomationStore): void {
  if (controller.store.getSnapshot().status === 'idle') return
  void controller.load()
}
