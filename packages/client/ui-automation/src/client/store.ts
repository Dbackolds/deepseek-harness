/**
 * Host Automation page store: the Host remains the single fact source.
 * Every mutation writes through the wire and the page re-renders from the
 * next list, pushed or refetched.
 */

import type { IApiClient, RpcResponse, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
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
  /** Whether the center-column Automation page is showing. */
  pageOpen: boolean
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

/** How long run-now waits for the started Session to appear in the list. */
const LISTED_SESSION_WAIT_MS = 10_000

/** Host Automation list and mutation owner. */
export class AutomationStore {
  /** UI-facing immutable projection. */
  readonly store: SnapshotStore<AutomationState> = createSnapshotStore<AutomationState>({
    status: 'idle',
    error: null,
    items: [],
    pageOpen: false,
  })

  /**
   * @param api - automation wire face.
   * @param sessions - list store used to wait for and open a started fire.
   * @param listedSessionWaitMs - how long a started fire waits for the list.
   */
  constructor(
    private readonly api: Pick<IApiClient, 'automation'>,
    private readonly sessions: Pick<ISessions, 'list' | 'open'>,
    private readonly listedSessionWaitMs: number = LISTED_SESSION_WAIT_MS,
  ) {}

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
      this.store.update((draft) => {
        draft.status = 'ready'
        draft.error = null
        draft.items = value.items
      })
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
   * Fire one rule immediately without moving its next target. A started run
   * closes the Automation page and opens the new Session; skipped or failed
   * outcomes stay on the page with the Host error.
   * @param id - existing rule.
   * @returns the failure message, or undefined once the write landed.
   */
  async runNow(id: AutomationRuleView['id']): Promise<string | undefined> {
    try {
      const run = valueOf(await this.api.automation.runNow({ id })).run
      if (run.outcome === 'started' && run.sessionId !== undefined) {
        try {
          await waitForListedSession(this.sessions, run.sessionId, this.listedSessionWaitMs)
        } catch {
          // waitForListedSession rejects only when the list never carries the Session.
          return 'missing_session'
        }
        this.setPageOpen(false)
        this.sessions.open(run.sessionId)
        return undefined
      }
      if (run.outcome === 'skipped_busy') {
        return run.errorCode === 'max_concurrent_runs' ? 'max_concurrent_runs' : 'skipped_busy'
      }
      if (run.outcome === 'failed') return 'failed'
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

  /**
   * Show or hide the center-column Automation page.
   * @param open - next page visibility.
   */
  setPageOpen(open: boolean): void {
    this.store.update((draft) => {
      draft.pageOpen = open
    })
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

/**
 * Wait until the Host list (or a later session-added frame) carries `id`.
 * `sessions.open` rejects unknown ids; fire publishes the Session before
 * this RPC returns, but the list frame can arrive after the unary echo.
 * @param sessions - list store that receives host/session-added.
 * @param id - Session the started run opened.
 * @param timeoutMs - give up after this many milliseconds.
 */
function waitForListedSession(
  sessions: Pick<ISessions, 'list'>,
  id: SessionId,
  timeoutMs: number = LISTED_SESSION_WAIT_MS,
): Promise<void> {
  if (sessions.list.getSnapshot().byId[id] !== undefined) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      stop()
      clearTimeout(timer)
      if (error === undefined) resolve()
      else reject(error)
    }
    const stop = sessions.list.subscribe(() => {
      if (sessions.list.getSnapshot().byId[id] !== undefined) finish()
    })
    const timer = setTimeout(() => {
      finish(new Error('started session did not appear in the list'))
    }, timeoutMs)
    if (sessions.list.getSnapshot().byId[id] !== undefined) finish()
  })
}
