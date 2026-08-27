/**
 * The workspace browser's viewing store: the session-list grouping mode,
 * persisted across reloads. Module level exports the factory only (a
 * module-level handle would pin the store identity across plugin reloads);
 * register() receives the factory and the browser derives its PropsStore
 * share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Browser-local order account for the hierarchy-free flat Session list. */
export const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

/** Session-list grouping mode: workspace sections or one flat recency list. */
export type SessionGroupBy = 'workspace' | 'flat'
/** Session order: user-arranged only, or user-arranged plus activity promotion. */
export type SessionOrderBy = 'manual' | 'updated'
/** Whether Completed / Running / Abnormal / History headings fold the list. */
export type SessionActivityLayout = 'folders' | 'inline'
/**
 * Whether empty project Workspaces stay in the grouped main list.
 * Persist rehydrate is a whole-value JSON replace, so a missing field is not
 * `'hide'`; every read treats only `'hide'` as Auto-hide.
 */
export type SessionEmptyWorkspaces = 'show' | 'hide'

/** Workspace browser viewing state persisted across surface remounts and reloads. */
type WorkspaceViewState = {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  /** Foldable status headings, or live work above idle rows with no headings. */
  activityLayout: SessionActivityLayout
  /**
   * Omit empty project Workspaces from the grouped main list when `'hide'`.
   * A rehydrated v8 blob that omits this field is Always show.
   */
  emptyWorkspaces: SessionEmptyWorkspaces
  /** Explicit zero-or-five-session state keyed by Workspace group identity. */
  groupExpansion: Record<string, boolean>
  /** Shared editable order per Workspace group plus the browser-local flat-list account. */
  sessionOrderByAccount: Record<string, string[]>
  /** Last observed update timestamps per order account for one-time promotion events. */
  sessionUpdatedAtByAccount: Record<string, Record<string, number>>
  /** Folded Pinned heading, keyed as `__pinned__:pinned`. Absent = expanded. */
  activityExpansion: Record<string, boolean>
  /** Browser-local pinned Session ids, newest pin last, shown under the Workspace header. */
  pinnedSessionIds: string[]
}

/**
 * Annotation twin of the actions literal below (the export needs a declared
 * return type); drift fails assignability at the defineStore call.
 */
type WorkspaceViewActions = {
  setGroupBy: (draft: WorkspaceViewState, mode: SessionGroupBy) => void
  setOrderBy: (draft: WorkspaceViewState, mode: SessionOrderBy) => void
  setActivityLayout: (draft: WorkspaceViewState, mode: SessionActivityLayout) => void
  setEmptyWorkspaces: (draft: WorkspaceViewState, mode: SessionEmptyWorkspaces) => void
  setGroupExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  retainAccountKeys: (draft: WorkspaceViewState, workspaceKeys: readonly string[]) => void
  syncSessionOrderAccount: (
    draft: WorkspaceViewState,
    accountKey: string,
    order: string[],
    updatedAt: Record<string, number>,
  ) => void
  setSessionOrder: (draft: WorkspaceViewState, accountKey: string, order: string[]) => void
  setActivityExpanded: (draft: WorkspaceViewState, key: string, expanded: boolean) => void
  pinSession: (draft: WorkspaceViewState, sessionId: string) => void
  unpinSession: (draft: WorkspaceViewState, sessionId: string) => void
}

/**
 * Create the workspace browser viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkspaceViewStore(): EngineStoreHandle<WorkspaceViewState, WorkspaceViewActions> {
  return defineStore({
    init: (): WorkspaceViewState => ({
      groupBy: 'workspace',
      orderBy: 'updated',
      activityLayout: 'folders',
      emptyWorkspaces: 'show',
      groupExpansion: {},
      sessionOrderByAccount: {},
      sessionUpdatedAtByAccount: {},
      activityExpansion: {},
      pinnedSessionIds: [],
    }),
    persist: 'dsh.workspace.view.v8',
    actions: {
      setGroupBy: (d, mode: SessionGroupBy) => { d.groupBy = mode },
      setOrderBy: (d, mode: SessionOrderBy) => { d.orderBy = mode },
      setActivityLayout: (d, mode: SessionActivityLayout) => { d.activityLayout = mode },
      setEmptyWorkspaces: (d, mode: SessionEmptyWorkspaces) => { d.emptyWorkspaces = mode },
      setGroupExpanded: (d, key: string, expanded: boolean) => { d.groupExpansion[key] = expanded },
      retainAccountKeys: (d, workspaceKeys: readonly string[]) => {
        const retained = new Set(workspaceKeys)
        d.groupExpansion = Object.fromEntries(
          Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)),
        )
        d.sessionOrderByAccount = Object.fromEntries(
          Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)),
        )
        d.sessionUpdatedAtByAccount = Object.fromEntries(
          Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)),
        )
        d.activityExpansion = Object.fromEntries(
          Object.entries(d.activityExpansion).filter(([key]) => {
            const sep = key.lastIndexOf(':')
            return sep !== -1 && retained.has(key.slice(0, sep))
          }),
        )
      },
      syncSessionOrderAccount: (d, accountKey: string, order: string[], updatedAt: Record<string, number>) => {
        d.sessionOrderByAccount[accountKey] = order
        d.sessionUpdatedAtByAccount[accountKey] = updatedAt
      },
      setSessionOrder: (d, accountKey: string, order: string[]) => {
        d.sessionOrderByAccount[accountKey] = order
      },
      setActivityExpanded: (d, key: string, expanded: boolean) => {
        d.activityExpansion[key] = expanded
      },
      pinSession: (d, sessionId: string) => {
        d.pinnedSessionIds = [...d.pinnedSessionIds.filter(id => id !== sessionId), sessionId]
      },
      unpinSession: (d, sessionId: string) => {
        d.pinnedSessionIds = d.pinnedSessionIds.filter(id => id !== sessionId)
      },
    },
  })
}
