/**
 * Hero branch-chip controller: the overlay the CURRENT session uses.
 *
 * The chip loads when a session with a workspace checkout is current,
 * then checkout / createBranch write the host overlay. Each session
 * keeps its own worktree; switching sessions reloads that session state.
 */

import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type SessionId, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Host git.describe snapshot, mirrored locally so the chip stays off the host package. */
type SessionGitView = Awaited<ReturnType<IApiClient['git']['describe']>> extends { result: infer R }
  ? R extends { ok: true; value: infer V } ? V : never
  : never

/** Hero-chip snapshot. */
export interface GitBranchSeatState {
  /** Current session the chip describes, empty until one is current. */
  sessionId: string
  /** Host snapshot, absent until the first successful load. */
  view: SessionGitView | null
  /** True after the host said the workspace is not a Git checkout. */
  unavailable: boolean
  /** A rejected switch message, cleared by the next attempt. */
  error: string | null
  busy: boolean
}

const INITIAL: GitBranchSeatState = {
  sessionId: '', view: null, unavailable: false, error: null, busy: false,
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Loads and switches the current session Git overlay. */
export class GitBranchSeatController {
  /** Chip snapshot the renderer subscribes to. */
  readonly store: SnapshotStore<GitBranchSeatState> = createSnapshotStore(INITIAL)

  constructor(
    private readonly api: Pick<IApiClient, 'git'>,
    /** The session the hero is showing, when there is one. */
    private readonly currentSessionId: () => SessionId | undefined,
  ) {}

  private set(patch: Partial<GitBranchSeatState>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch })
  }

  /**
   * Read the current session overlay from the host.
   * @returns once the snapshot reflects the host.
   */
  async load(): Promise<void> {
    const sessionId = this.currentSessionId()
    if (sessionId === undefined) {
      this.store.set(INITIAL)
      return
    }
    try {
      const response = await this.api.git.describe({ sessionId })
      if (!response.result.ok) {
        const unavailable = response.result.error.code === 'git-not-a-repository'
        this.set({
          sessionId,
          view: null,
          unavailable,
          error: unavailable ? null : response.result.error.message,
        })
        return
      }
      this.set({
        sessionId,
        view: response.result.value,
        unavailable: false,
        error: null,
      })
    } catch (error) {
      this.set({ sessionId, error: messageOf(error) })
    }
  }

  /**
   * Check one existing branch out for the current session.
   * @param branch - branch to switch to.
   * @returns once the overlay settled.
   */
  async checkout(branch: string): Promise<void> {
    await this.mutate(sessionId => this.api.git.checkout({ sessionId, branch }))
  }

  /**
   * Create a new local branch and check it out for the current session.
   * @param branch - new branch name.
   * @returns once the overlay settled.
   */
  async createBranch(branch: string): Promise<void> {
    await this.mutate(sessionId => this.api.git.createBranch({ sessionId, branch }))
  }

  private async mutate(
    run: (sessionId: SessionId) => ReturnType<IApiClient['git']['checkout']>,
  ): Promise<void> {
    const sessionId = this.currentSessionId()
    if (sessionId === undefined || this.store.getSnapshot().busy) return
    this.set({ busy: true, error: null })
    try {
      const response = await run(sessionId)
      if (!response.result.ok) {
        this.set({ busy: false, error: response.result.error.message })
        return
      }
      this.set({
        sessionId,
        view: response.result.value,
        unavailable: false,
        error: null,
        busy: false,
      })
    } catch (error) {
      this.set({ busy: false, error: messageOf(error) })
    }
  }
}
