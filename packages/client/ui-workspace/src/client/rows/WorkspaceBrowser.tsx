/**
 * The workspace/session browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + view options + add
 * workspace), search, the grouped tree or flat list, and the workspace
 * dialogs. Wide state renders the full browser; rail state renders the two
 * region icons (search / add workspace) as 36px controls on the shell's shared
 * rail entry path, each requesting expansion through the owner share. Adding
 * is the header button's one action, so it raises the directory flow with no
 * menu in between; the flow and its error dialog live in WorkspacePicker
 * (same package — direct composition, no slot between them).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Button, IconCloseFill14, IconPersonalizationOutline16,
  IconProjectAddOutline16, IconSearchOutline16, IconTriangleRightFill14, Menu, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionListState, SessionSearchResultItem,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type {
  SessionActivityBucket, SessionListCluster, SessionNode, SessionOrderBy,
} from '../tree.ts'
import {
  BADGED_ACTIVITY_BUCKETS, deriveFlat, deriveGroups, deriveHiddenGroups, deriveSearchResults,
  isNoRepoWorkspace, partitionLiveIdle, partitionSessionActivity, sessionActivityBucket,
  HIDDEN_SECTION_KEY, owningGroupKey, UNGROUPED_KEY,
} from '../tree.ts'
import { ProjectRowItem, SearchResultItem, SessionNodeItem } from './Rows.tsx'
import { FLAT_SESSION_ORDER_KEY, type SessionActivityLayout, type SessionEmptyWorkspaces } from '../stores.ts'
import {
  nextSessionOverflowLimit, ordinarySessionCount, resolvedSessionOverflowLimit,
  sessionOverflowCanCollapse, sessionOverflowRevealCount, sessionOverflowStep,
  type SessionOverflowLimit,
} from '../session-overflow.ts'
import { WorkspacePickFlow } from '../WorkspacePicker.tsx'
import css from './WorkspaceBrowser.module.css'

/**
 * Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
 * focus() forces a synchronous layout and would jank the slide.
 */
const EXPAND_SLIDE_MS = 300
/** Pause between the latest keystroke and a Host content-search request. */
const SEARCH_DEBOUNCE_MS = 250
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
const SEARCH_QUERY_MAX_CODE_UNITS = 500
/** Folded Pinned heading; absent in the store means expanded. */
const PINNED_EXPANSION_KEY = '__pinned__:pinned'

/** Fold idle/History rows without charging a provisional New Session against the ordinary-row limit. */
function collapsedSessionRows(sessions: readonly SessionNode[], limit: number | null): {
  rows: readonly SessionNode[]
  hiddenCount: number
  ordinaryCount: number
} {
  const ordinaryCount = ordinarySessionCount(sessions)
  if (limit === null || ordinaryCount <= limit) {
    return { rows: sessions, hiddenCount: 0, ordinaryCount }
  }
  let shownOrdinary = 0
  const rows = sessions.filter((session) => {
    if (session.blank) return true
    if (shownOrdinary >= limit) return false
    shownOrdinary += 1
    return true
  })
  return { rows, hiddenCount: sessions.length - rows.length, ordinaryCount }
}

/** Expand-more and optional Show less controls for one idle/History overflow cluster. */
function SessionOverflowControls({
  t,
  hiddenCount,
  ordinaryCount,
  overflowStep,
  visibleLimit,
  canCollapse,
  tabIndex,
  onExpand,
  onCollapse,
}: {
  t: WorkspaceBrowserProps['t']
  hiddenCount: number
  ordinaryCount: number
  overflowStep: number | null
  visibleLimit: number | null
  canCollapse: boolean
  tabIndex?: number | undefined
  onExpand: () => void
  onCollapse: () => void
}) {
  if (overflowStep === null) return null
  const showExpand = hiddenCount > 0
  if (!showExpand && !canCollapse) return null
  return (
    <div className={css.sessionOverflowRow}>
      {showExpand && (
        <button
          type="button"
          className={css.sessionOverflowButton}
          aria-expanded={false}
          tabIndex={tabIndex}
          onClick={onExpand}
        >
          {t('sessions.expand', {
            n: sessionOverflowRevealCount(visibleLimit ?? 0, overflowStep, ordinaryCount),
          })}
        </button>
      )}
      {canCollapse && (
        <button
          type="button"
          className={clsx(css.sessionOverflowButton, css.sessionOverflowCollapse)}
          aria-expanded={true}
          tabIndex={tabIndex}
          onClick={onCollapse}
        >
          {t('sessions.collapse')}
        </button>
      )}
    </div>
  )
}

/** Localized heading for one activity section. */
function activitySectionLabel(
  bucket: SessionActivityBucket,
  t: WorkspaceBrowserProps['t'],
): string {
  if (bucket === 'pinned') return t('section.pinned')
  if (bucket === 'unread') return t('section.unread')
  if (bucket === 'running') return t('section.running')
  if (bucket === 'abnormal') return t('section.abnormal')
  return t('section.history')
}

/**
 * Persist key for one activity section's fold inside a Workspace or the flat list.
 * @param accountKey - Workspace group key or the flat-list account.
 * @param bucket - activity section.
 * @returns store key `${accountKey}:${bucket}`.
 */
function activityExpansionKey(accountKey: string, bucket: SessionActivityBucket): string {
  return `${accountKey}:${bucket}`
}

/**
 * True when the section heading shows a count badge.
 * @param bucket - activity section.
 * @returns whether the heading includes a count.
 */
function isBadgedActivityBucket(
  bucket: SessionActivityBucket,
): bucket is typeof BADGED_ACTIVITY_BUCKETS[number] {
  return BADGED_ACTIVITY_BUCKETS.includes(bucket as typeof BADGED_ACTIVITY_BUCKETS[number])
}

/** Live work vs idle remainder; drag stays inside the cluster it started in. */
function sessionListCluster(node: SessionNode): SessionListCluster {
  return sessionActivityBucket(node) === 'running' ? 'live' : 'idle'
}

/**
 * Foldable heading for Pinned and, when status folders are on, Completed /
 * Running / Abnormal / History.
 */
function ActivitySectionHeading({
  bucket, count, expanded, onToggle, t, label: labelOverride,
}: {
  bucket: SessionActivityBucket
  count: number
  expanded: boolean
  onToggle: () => void
  t: WorkspaceBrowserProps['t']
  /** Override the bucket's localized heading (Hidden section). */
  label?: string
}) {
  const label = labelOverride ?? activitySectionLabel(bucket, t)
  const badged = labelOverride === undefined && isBadgedActivityBucket(bucket)
  return (
    <h3 className={css.activityHeading}>
      <button
        type="button"
        className={css.activityToggle}
        aria-expanded={expanded}
        aria-label={badged ? t('section.count.aria', { label, n: count }) : label}
        onClick={onToggle}
      >
        <IconTriangleRightFill14 className={clsx(css.activityChevron, expanded && css.activityChevronOpen)} />
        <span className={css.activityLabel}>{label}</span>
        {badged && (
          <span className={clsx(css.activityCount, css[`activityCount_${bucket}`])} aria-hidden="true">
            {count}
          </span>
        )}
      </button>
    </h3>
  )
}

/** Keep controlled input and RPC payload inside the session.search wire contract. */
function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  let end = SEARCH_QUERY_MAX_CODE_UNITS
  const last = withoutNul.charCodeAt(end - 1)
  const next = withoutNul.charCodeAt(end)
  if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end--
  return withoutNul.slice(0, end)
}

/**
 * Accept the native drag at document level while a row drag is active: row
 * hover still owns the insertion marker, and releasing outside the list must
 * not be rendered as a rejected drop before dragend commits that last marker.
 */
function useNativeDragAcceptance(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const acceptDrag = (event: DragEvent): void => {
      event.preventDefault()
      if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
    }
    const acceptDrop = (event: DragEvent): void => { event.preventDefault() }
    document.addEventListener('dragover', acceptDrag)
    document.addEventListener('drop', acceptDrop)
    return () => {
      document.removeEventListener('dragover', acceptDrag)
      document.removeEventListener('drop', acceptDrop)
    }
  }, [active])
}

/** Reconcile a stored view order with the Workspace's current session account. */
function reconciledSessionOrder(sessionIds: readonly SessionId[], stored: readonly string[] | undefined): SessionId[] {
  if (stored === undefined) return [...sessionIds]
  const byId = new Map(sessionIds.map(id => [id as string, id]))
  const ordered: SessionId[] = []
  const included = new Set<string>()
  for (const key of stored) {
    const id = byId.get(key)
    if (id === undefined || included.has(key)) continue
    ordered.push(id)
    included.add(key)
  }
  for (const id of sessionIds) {
    if (included.has(id)) continue
    ordered.push(id)
  }
  return ordered
}

/** Newest update first with stable Session identity as the tie-break. */
function compareSessionRecency(a: SessionId, b: SessionId, byId: SessionListState['byId']): number {
  const aUpdatedAt = byId[a]?.updatedAt ?? Number.NEGATIVE_INFINITY
  const bUpdatedAt = byId[b]?.updatedAt ?? Number.NEGATIVE_INFINITY
  if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt
  return a < b ? -1 : 1
}

/** Reconcile one editable order account and apply its activity-promotion policy. */
function nextSessionOrderAccount({
  sessionIds, previousOrder, previousUpdatedAt, list, orderBy, sortByRecency,
}: {
  sessionIds: readonly SessionId[]
  previousOrder: readonly string[] | undefined
  previousUpdatedAt: Readonly<Record<string, number>>
  list: SessionListState
  orderBy: SessionOrderBy
  sortByRecency: boolean
}): { order: SessionId[]; updatedAt: Record<string, number>; changed: boolean } {
  let order = reconciledSessionOrder(sessionIds, previousOrder)
  if (sortByRecency) {
    order.sort((a, b) => compareSessionRecency(a, b, list.byId))
  } else if (orderBy === 'updated') {
    const promoted = sessionIds
      .filter((id) => {
        const session = list.byId[id]
        return session !== undefined
          && (previousUpdatedAt[id] === undefined || session.updatedAt > previousUpdatedAt[id])
      })
      .sort((a, b) => compareSessionRecency(a, b, list.byId))
    if (promoted.length > 0) {
      const promotedIds = new Set(promoted)
      order = [...promoted, ...order.filter(id => !promotedIds.has(id))]
    }
  }
  const updatedAt: Record<string, number> = {}
  for (const id of sessionIds) {
    const session = list.byId[id]
    if (session !== undefined) updatedAt[id] = session.updatedAt
  }
  const orderChanged = previousOrder === undefined
    || order.length !== previousOrder.length
    || order.some((id, index) => id !== previousOrder[index])
  const timestampsChanged = Object.keys(updatedAt).length !== Object.keys(previousUpdatedAt).length
    || Object.entries(updatedAt).some(([id, timestamp]) => previousUpdatedAt[id] !== timestamp)
  return { order, updatedAt, changed: orderChanged || timestampsChanged }
}

/** Grouping and ordering menu; own open state so it resets with the wide chrome. */
function ViewOptionsMenu({
  groupBy, orderBy, activityLayout, emptyWorkspaces,
  onGroupPick, onOrderPick, onActivityLayoutPick, onEmptyWorkspacesPick, t,
}: {
  groupBy: 'workspace' | 'flat'
  orderBy: SessionOrderBy
  activityLayout: SessionActivityLayout
  emptyWorkspaces: SessionEmptyWorkspaces
  onGroupPick: (mode: 'workspace' | 'flat') => void
  onOrderPick: (mode: SessionOrderBy) => void
  onActivityLayoutPick: (mode: SessionActivityLayout) => void
  onEmptyWorkspacesPick: (mode: SessionEmptyWorkspaces) => void
  t: WorkspaceBrowserProps['t']
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { type: 'label' as const, id: 'group-by', text: t('groupBy.label') },
        { id: 'workspace', label: t('groupBy.workspace') },
        { id: 'flat', label: t('groupBy.flat') },
        { type: 'separator' as const, id: 'order-by-separator' },
        { type: 'label' as const, id: 'order-by', text: t('orderBy.label') },
        { id: 'manual', label: t('orderBy.manual') },
        { id: 'updated', label: t('orderBy.updated') },
        { type: 'separator' as const, id: 'activity-layout-separator' },
        { type: 'label' as const, id: 'activity-layout', text: t('activityLayout.label') },
        { id: 'folders', label: t('activityLayout.folders') },
        { id: 'inline', label: t('activityLayout.inline') },
        { type: 'separator' as const, id: 'empty-workspaces-separator' },
        { type: 'label' as const, id: 'empty-workspaces', text: t('emptyWorkspaces.label') },
        { id: 'empty-hide', label: t('emptyWorkspaces.hide') },
        { id: 'empty-show', label: t('emptyWorkspaces.show') },
      ]}
      selectedIds={[
        groupBy,
        orderBy,
        activityLayout,
        emptyWorkspaces === 'hide' ? 'empty-hide' : 'empty-show',
      ]}
      onSelect={(id) => {
        if (id === 'workspace' || id === 'flat') onGroupPick(id)
        else if (id === 'manual' || id === 'updated') onOrderPick(id)
        else if (id === 'folders' || id === 'inline') onActivityLayoutPick(id)
        else if (id === 'empty-hide') onEmptyWorkspacesPick('hide')
        else if (id === 'empty-show') onEmptyWorkspacesPick('show')
        setOpen(false)
      }}
      align="end"
      dense
      // Portal: the section header clips overflow, so an in-place list would
      // be cut off at the header's bounds.
      portal
      anchor={(
        <Tooltip label={t('viewOptions.label')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={clsx(css.iconButton, css.wide)}
            aria-label={t('viewOptions.label')}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconPersonalizationOutline16 />
          </button>
        </Tooltip>
      )}
    />
  )
}

/** In-flight root-row drag: source identity plus the current insert marker. */
interface DragState {
  /** Workspace id, or {@link UNGROUPED_KEY} for the browser-local loose-session account. */
  accountKey: string
  sessionId: SessionNode['id']
  /** Live or idle cluster the drag started in; drops stay inside this cluster. */
  cluster: SessionListCluster
  /** Status folder the drag started in when folders are on. */
  bucket: SessionActivityBucket
  /** Row the marker sits on and which half (insert above/below it). */
  over: { id: SessionNode['id']; half: 'before' | 'after' } | null
}

/** Neighbors a Session drag may land on in the current activity layout. */
function dragNeighbors(
  sessions: readonly SessionNode[],
  layout: SessionActivityLayout,
  active: DragState,
): readonly SessionNode[] {
  if (layout === 'inline') {
    const clusters = partitionLiveIdle(sessions)
    return active.cluster === 'live' ? clusters.live : clusters.idle
  }
  return partitionSessionActivity(sessions)
    .find(section => section.bucket === active.bucket)?.sessions ?? []
}

/** In-flight Workspace-row drag: source identity plus the current marker. */
interface WorkspaceDragState {
  workspaceId: WorkspaceId
  over: { id: WorkspaceId; half: 'before' | 'after' } | null
}

/** Resolve an insertion side from the full rendered workspace group. */
function workspaceGroupHalf(e: { clientY: number; currentTarget: HTMLElement }): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect()
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

type SessionTreeProps = Pick<
  WorkspaceBrowserProps,
  'useSessions' | 'useSessionPendingInteraction' | 'startSession' | 'open' | 'forkSession'
  | 'insertWorkspaceBefore' | 'insertSessionBefore' | 'markUnread' | 'openPath' | 'openSplit' | 't'
> & {
  hiddenWorkspaceIds: readonly WorkspaceId[]
  /** Host account home for POSIX hover-path abbreviation. */
  home?: string | undefined
  workspaces: readonly WorkspaceView[]
  /** Whether the current Workspace stream has a complete Host baseline. */
  workspaceReady: boolean
  /** Explicit persisted zero-or-five-session state by Workspace group. */
  groupExpansion: Readonly<Record<string, boolean>>
  /** Persist one Workspace group's zero-or-five-session state. */
  setGroupExpanded: (key: string, expanded: boolean) => void
  /** Shared editable orders used by Workspace groups and the flat-list account. */
  sessionOrderByAccount: Readonly<Record<string, readonly string[]>>
  /** Last update timestamps observed for one-time recent-update promotions. */
  sessionUpdatedAtByAccount: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Replace one shared order and its observed timestamps. */
  syncSessionOrderAccount: (accountKey: string, order: string[], updatedAt: Record<string, number>) => void
  /** Apply a drag to one shared order. */
  setSessionOrder: (accountKey: string, order: string[]) => void
  /** Folded Pinned heading keyed as `__pinned__:pinned`. Absent = expanded. */
  activityExpansion: Readonly<Record<string, boolean>>
  /** Persist one activity section's fold. */
  setActivityExpanded: (key: string, expanded: boolean) => void
  /** Foldable status headings, or live work above idle rows. */
  activityLayout: SessionActivityLayout
  /**
   * Omit empty project Workspaces from the grouped main list when `'hide'`.
   * Anything other than `'hide'` is Always show.
   */
  emptyWorkspaces: SessionEmptyWorkspaces
  /** Registry-global archive set (hidden rows). */
  archivedSessionIds: readonly SessionNode['id'][]
  /** Open the browser-owned rename dialog for a real Workspace group. */
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  /** Hide a visible Workspace immediately (no confirmation). */
  onHideRequest: (workspaceId: WorkspaceId) => void
  /** Show a hidden Workspace immediately (no confirmation). */
  onShowRequest: (workspaceId: WorkspaceId) => void
  /** Open the browser-owned delete-confirmation dialog for a real Workspace group. */
  onDeleteRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  /** Open the composed directory flow to add an additional folder. */
  onAddFolderRequest: (workspaceId: WorkspaceId) => void
  /** Remove one additional folder from a real Workspace group. */
  onRemoveFolderRequest: (workspaceId: WorkspaceId, path: string) => void
  /** Open the browser-owned session rename dialog. */
  onSessionRename: (sessionId: SessionNode['id'], currentTitle: string) => void
  /** Archive a session (row menu action; the row disappears on the state echo). */
  onSessionArchive: (sessionId: SessionNode['id']) => void
  /** Pin a session under the Pinned heading. */
  onSessionPin: (sessionId: SessionNode['id']) => void
  /** Remove a session from the Pinned heading. */
  onSessionUnpin: (sessionId: SessionNode['id']) => void
  /** Session ids currently pinned above the Workspace list. */
  pinnedSessionIds: readonly string[]
  /** Session order behavior: fixed after edits, or additionally promoted by user activity. */
  orderBy: SessionOrderBy
  /** Settings-owned overflow step, or expand-all. */
  sessionOverflowLimit: SessionOverflowLimit  /** One Session chosen from search that must be exposed and scrolled into view. */
  revealSessionId?: SessionId | undefined
  /** Acknowledge that the chosen Session row has been revealed. */
  onSessionRevealed: (sessionId: SessionId) => void
}

/** The scrolling session tree; unmounting drops the sessions subscription and expand-all state. */
function SessionTree({
  useSessions, useSessionPendingInteraction, startSession, open, forkSession, workspaces, archivedSessionIds,
  workspaceReady,
  revealSessionId, onSessionRevealed,
  hiddenWorkspaceIds,
  onRenameRequest, onHideRequest, onShowRequest, onDeleteRequest, onAddFolderRequest, onRemoveFolderRequest,
  onSessionRename, onSessionArchive, onSessionPin, onSessionUnpin, pinnedSessionIds,
  insertWorkspaceBefore, insertSessionBefore, markUnread, openPath, openSplit, orderBy, activityLayout, emptyWorkspaces,
  groupExpansion, setGroupExpanded,
  sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder,
  activityExpansion, setActivityExpanded, home, t, sessionOverflowLimit,
}: SessionTreeProps) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const current = list.current
  const [sessionOverflowByAccount, setSessionOverflowByAccount] = useState<Record<string, number>>({})
  const overflowStep = sessionOverflowStep(sessionOverflowLimit)
  const revealGroup = revealSessionId === undefined || !workspaceReady
    ? undefined
    : owningGroupKey(workspaces, revealSessionId)
    // Transient drag marker state; the selected mode owns the resulting order.
  const [drag, setDrag] = useState<DragState | null>(null)
  const sessionDropCommitted = useRef(false)
  const [workspaceDrag, setWorkspaceDrag] = useState<WorkspaceDragState | null>(null)
  const workspaceDropCommitted = useRef(false)
  const previousOrderBy = useRef(orderBy)
  const nativeDragActive = drag !== null || workspaceDrag !== null
  useNativeDragAcceptance(nativeDragActive)
  const currentGroup = current === undefined || !workspaceReady
    ? undefined
    : owningGroupKey(workspaces, current)
  useEffect(() => {
    if (current === undefined || currentGroup === undefined || Object.hasOwn(groupExpansion, currentGroup)) return
    setGroupExpanded(currentGroup, true)
  }, [current, currentGroup, setGroupExpanded, groupExpansion])
  const hiddenWorkspaceSet = useMemo(() => new Set(hiddenWorkspaceIds), [hiddenWorkspaceIds])
  useEffect(() => {
    if (currentGroup === undefined || currentGroup === UNGROUPED_KEY) return
    if (!hiddenWorkspaceSet.has(currentGroup as WorkspaceId)) return
    if (Object.hasOwn(groupExpansion, HIDDEN_SECTION_KEY)) return
    setGroupExpanded(HIDDEN_SECTION_KEY, true)
  }, [currentGroup, groupExpansion, hiddenWorkspaceSet, setGroupExpanded])
  const expandedGroups = useMemo(
    () => Object.entries(groupExpansion).filter(([, expanded]) => expanded).map(([key]) => key),
    [groupExpansion],
  )
  const ungroupedSessionIds = useMemo(() => {
    const accounted = new Set(workspaces.flatMap(workspace => workspace.sessionIds))
    return list.ids.filter((id: SessionId) => list.byId[id] !== undefined && !accounted.has(id))
  }, [list, workspaces])
  useEffect(() => {
    if (list.phase !== 'ready') return
    const switchedToUpdated = previousOrderBy.current !== 'updated' && orderBy === 'updated'
    previousOrderBy.current = orderBy
    const accounts = [
      ...workspaces.map(workspace => ({
        key: workspace.workspaceId as string,
        sessionIds: workspace.sessionIds.filter(id => list.byId[id] !== undefined),
      })),
      { key: UNGROUPED_KEY, sessionIds: ungroupedSessionIds },
    ]
    for (const { key, sessionIds } of accounts) {
      const previousOrder = sessionOrderByAccount[key]
      const previousUpdatedAt = sessionUpdatedAtByAccount[key] ?? {}
      const next = nextSessionOrderAccount({
        sessionIds,
        previousOrder,
        previousUpdatedAt,
        list,
        orderBy,
        sortByRecency: orderBy === 'updated' && (previousOrder === undefined || switchedToUpdated),
      })
      if (next.changed) {
        syncSessionOrderAccount(key, next.order.map(id => id as string), next.updatedAt)
      }
    }
  }, [list, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, ungroupedSessionIds, workspaces])
  const orderedWorkspaces = useMemo(() => {
    return workspaces.map((workspace) => {
      const stored = sessionOrderByAccount[workspace.workspaceId as string]
      const sessionIds = reconciledSessionOrder(workspace.sessionIds, stored)
      return { ...workspace, sessionIds }
    })
  }, [sessionOrderByAccount, workspaces])
  const orderedUngroupedSessionIds = useMemo(
    () => reconciledSessionOrder(ungroupedSessionIds, sessionOrderByAccount[UNGROUPED_KEY]),
    [sessionOrderByAccount, ungroupedSessionIds],
  )
  const hiddenOwnedSessionIds = useMemo(
    () => workspaces.flatMap(workspace =>
      hiddenWorkspaceSet.has(workspace.workspaceId) && !isNoRepoWorkspace(workspace)
        ? [...workspace.sessionIds]
        : []),
    [hiddenWorkspaceSet, workspaces],
  )
  const groups = useMemo(() => {
    const pinned = new Set(pinnedSessionIds)
    return deriveGroups(list, orderedWorkspaces, archivedSessionIds, pendingInteractions, {
      expandedGroups,
      ...(sessionOrderByAccount[UNGROUPED_KEY] === undefined
        ? {}
        : { ungroupedOrder: sessionOrderByAccount[UNGROUPED_KEY] }),
    }, hiddenWorkspaceIds, emptyWorkspaces).map(group => ({
      ...group,
      sessions: group.sessions.filter(session => !pinned.has(session.id)),
    }))
  }, [
    list, orderedWorkspaces, archivedSessionIds, pendingInteractions, expandedGroups,
    sessionOrderByAccount, pinnedSessionIds, hiddenWorkspaceIds, emptyWorkspaces,
  ])
  const pinnedRows = useMemo(() => {
    const byId = new Map(
      deriveFlat(list, archivedSessionIds, pendingInteractions, hiddenOwnedSessionIds)
        .map(session => [session.id as string, session]),
    )
    return pinnedSessionIds.flatMap((id) => {
      const session = byId.get(id)
      return session === undefined ? [] : [{ ...session, pinned: true as const }]
    })
  }, [list, archivedSessionIds, hiddenOwnedSessionIds, pendingInteractions, pinnedSessionIds])
  const visibleWorkspaces = useMemo(
    () => groups.flatMap(group =>
      group.key === UNGROUPED_KEY || group.workspaceId === undefined
        ? []
        : [{ workspaceId: group.workspaceId }]),
    [groups],
  )
  const hiddenGroups = useMemo(
    () => deriveHiddenGroups(
      list, orderedWorkspaces, archivedSessionIds, pendingInteractions, { expandedGroups }, hiddenWorkspaceIds,
    ),
    [list, orderedWorkspaces, archivedSessionIds, pendingInteractions, expandedGroups, hiddenWorkspaceIds],
  )
  useEffect(() => {
    if (revealGroup === undefined || groupExpansion[revealGroup] === true) return
    setGroupExpanded(revealGroup, true)
  }, [groupExpansion, revealGroup, setGroupExpanded])
  useEffect(() => {
    if (revealSessionId === undefined || revealGroup === undefined) return
    const group = groups.find(candidate => candidate.key === revealGroup)
    if (group === undefined || !group.expanded || !group.sessions.some(row => row.id === revealSessionId)) return
    if (collapsedSessionRows(group.sessions).rows.some(row => row.id === revealSessionId)) return
    setExpandedSessionGroups(keys => keys.includes(revealGroup) ? keys : [...keys, revealGroup])
  }, [groups, revealGroup, revealSessionId])
  const now = Date.now()
  const commitSessionDrag = (activeDrag: DragState, over: NonNullable<DragState['over']>): void => {
    if (sessionDropCommitted.current) return
    sessionDropCommitted.current = true
    setDrag(null)
    const group = groups.find(candidate => candidate.key === activeDrag.accountKey)
    if (group === undefined) return
    const neighbors = dragNeighbors(group.sessions, activityLayout, activeDrag)
    const overflowLimit = (
      activityLayout === 'inline'
        ? activeDrag.cluster === 'idle'
        : activeDrag.bucket === 'history'
    )
      ? resolvedSessionOverflowLimit(sessionOverflowByAccount[group.key], sessionOverflowLimit)
      : null
    const collapseNeighbors = overflowLimit !== null
    const renderedSessions = collapseNeighbors
      ? collapsedSessionRows(neighbors, overflowLimit).rows
      : neighbors
    const targetIndex = renderedSessions.findIndex(session => session.id === over.id)
    if (targetIndex === -1) return
    const sourceIndex = renderedSessions.findIndex(session => session.id === activeDrag.sessionId)
    if (over.id === activeDrag.sessionId) return
    const withoutSource = renderedSessions.filter(session => session.id !== activeDrag.sessionId)
    const targetWithoutSourceIndex = withoutSource.findIndex(session => session.id === over.id)
    if (targetWithoutSourceIndex === -1) return
    const visibleInsertAt = over.half === 'before' ? targetWithoutSourceIndex : targetWithoutSourceIndex + 1
    if (sourceIndex !== -1 && visibleInsertAt === sourceIndex) return
    const accountSessionIds = activeDrag.accountKey === UNGROUPED_KEY
      ? orderedUngroupedSessionIds
      : orderedWorkspaces.find(workspace => workspace.workspaceId === activeDrag.accountKey)?.sessionIds
    if (accountSessionIds === undefined) return
    const nextOrder = accountSessionIds.filter(id => id !== activeDrag.sessionId)
    let anchor: SessionId | undefined
    if (!collapseNeighbors) {
      anchor = over.half === 'before' ? over.id : renderedSessions[targetIndex + 1]?.id
    } else {
      // A collapsed History / idle cluster may render the blank row after hidden
      // ordinary rows. Place the source at the visible boundary before those
      // hidden account members.
      const previousVisible = withoutSource[visibleInsertAt - 1]?.id
      if (previousVisible === undefined) {
        anchor = nextOrder[0]
      } else {
        const previousIndex = nextOrder.indexOf(previousVisible)
        if (previousIndex === -1) return
        anchor = nextOrder[previousIndex + 1]
      }
    }
    const insertAt = anchor === undefined ? nextOrder.length : nextOrder.indexOf(anchor)
    nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId)
    if (collapseNeighbors && sourceIndex !== -1) {
      const nodes = new Map(neighbors.map(node => [node.id, node]))
      const nextGroup = nextOrder.flatMap((id) => {
        const node = nodes.get(id)
        return node === undefined ? [] : [node]
      })
      if (!collapsedSessionRows(nextGroup, overflowLimit).rows.some(node => node.id === activeDrag.sessionId)) return
    }
    setSessionOrder(activeDrag.accountKey, nextOrder.map(id => id as string))
    if (orderBy === 'updated' || activeDrag.accountKey === UNGROUPED_KEY) return
    insertSessionBefore(activeDrag.accountKey as WorkspaceId, activeDrag.sessionId, anchor).catch((reason: unknown) => {
      console.warn('session reorder rejected:', reason)
    })
  }
  const commitWorkspaceDrag = (
    activeDrag: WorkspaceDragState,
    over: NonNullable<WorkspaceDragState['over']>,
  ): void => {
    if (workspaceDropCommitted.current) return
    workspaceDropCommitted.current = true
    setWorkspaceDrag(null)
    const rowIndex = visibleWorkspaces.findIndex(workspace => workspace.workspaceId === over.id)
    if (rowIndex === -1) return
    const anchor = over.half === 'before' ? over.id : visibleWorkspaces[rowIndex + 1]?.workspaceId
    if (anchor === activeDrag.workspaceId) return
    const sourceIndex = visibleWorkspaces.findIndex(workspace => workspace.workspaceId === activeDrag.workspaceId)
    const anchorIndex = anchor === undefined
      ? visibleWorkspaces.length
      : visibleWorkspaces.findIndex(workspace => workspace.workspaceId === anchor)
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return
    insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason: unknown) => {
      console.warn('workspace reorder rejected:', reason)
    })
  }
  const workspaceDropAtListStart = groups[0]?.key !== UNGROUPED_KEY
    && groups[0]?.workspaceId !== undefined
    && workspaceDrag?.over?.id === groups[0].workspaceId
    && workspaceDrag.over.half === 'before'

  return (
    <div className={clsx(css.treeBody, css.wide)}>
      {workspaceDropAtListStart && <span className={css.listTopDropIndicator} aria-hidden="true" />}
      <div
        className={clsx(css.list, workspaceDropAtListStart && css.listTopDropActive)}
        role="tree"
        aria-label={t('section.sessions')}
      >
        {groups.length === 0 && pinnedRows.length === 0 && (
          <div className={css.empty}>{t('empty.none')}</div>
        )}
        {pinnedRows.length > 0 && (
          <div className={css.activitySection}>
            <ActivitySectionHeading
              bucket="pinned"
              count={pinnedRows.length}
              expanded={activityExpansion[PINNED_EXPANSION_KEY] !== false}
              onToggle={() => {
                setActivityExpanded(
                  PINNED_EXPANSION_KEY,
                  activityExpansion[PINNED_EXPANSION_KEY] === false,
                )
              }}
              t={t}
            />
            <div
              className={clsx(
                css.activityBody,
                activityExpansion[PINNED_EXPANSION_KEY] === false && css.activityBodyCollapsed,
              )}
              aria-hidden={activityExpansion[PINNED_EXPANSION_KEY] === false}
            >
              <div className={css.activityBodyInner}>
                {pinnedRows.map(node => (
                  <SessionNodeItem
                    key={node.id}
                    node={node}
                    currentId={current}
                    now={now}
                    onOpen={open}
                    onRename={onSessionRename}
                    onFork={forkSession}
                    onArchive={onSessionArchive}
                    onPin={onSessionPin}
                    onUnpin={onSessionUnpin}
                    onMarkUnread={markUnread}
                    onSplit={openSplit}
                    onRevealPath={(path) => { void openPath(path) }}
                    onRevealRow={node.id === revealSessionId
                      ? () => { onSessionRevealed(node.id) }
                      : undefined}
                    t={t}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {groups.map((group) => {
          const workspaceId = group.workspaceId
          const clusters = partitionLiveIdle(group.sessions)
          const idleLimit = resolvedSessionOverflowLimit(sessionOverflowByAccount[group.key], sessionOverflowLimit)
          const collapsedIdle = collapsedSessionRows(clusters.idle, idleLimit)
          const visibleIdle = collapsedIdle.rows
          const inlineVisible = [...clusters.live, ...visibleIdle]
          const folderSections = partitionSessionActivity(group.sessions)
            .filter(section => section.bucket !== 'pinned' && section.sessions.length > 0)
          const workspaceMarker = group.key !== UNGROUPED_KEY
            && workspaceId !== undefined
            && workspaceDrag?.over?.id === workspaceId
            ? workspaceDrag.over.half
            : null
          const workspaceDragProps = group.key === UNGROUPED_KEY || workspaceId === undefined ? undefined : {
            start: () => {
              workspaceDropCommitted.current = false
              setWorkspaceDrag({ workspaceId, over: null })
            },
            end: () => {
              if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) {
                commitWorkspaceDrag(workspaceDrag, workspaceDrag.over)
              } else {
                setWorkspaceDrag(null)
              }
              workspaceDropCommitted.current = false
            },
          }
          const hoverWorkspace = group.key === UNGROUPED_KEY || workspaceId === undefined
            ? undefined
            : (half: 'before' | 'after') => {
              setWorkspaceDrag(active => active === null
                ? active
                : { ...active, over: { id: workspaceId, half } })
            }
          const dropWorkspace = group.key === UNGROUPED_KEY || workspaceId === undefined
            ? undefined
            : (half: 'before' | 'after') => {
              if (workspaceDrag === null) return
              commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half })
            }
          const sessionDragProps = (node: SessionNode) => {
            const sameGroupDrag = drag !== null && drag.accountKey === group.key
            const bucket = sessionActivityBucket(node)
            const cluster = sessionListCluster(node)
            return {
              start: () => {
                sessionDropCommitted.current = false
                setDrag({ accountKey: group.key, sessionId: node.id, cluster, bucket, over: null })
              },
              active: sameGroupDrag && (activityLayout === 'folders' ? drag.bucket === bucket : drag.cluster === cluster),
              marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
              hover: (half: 'before' | 'after') => {
                /* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
                setDrag(d => (d === null ? d : { ...d, over: { id: node.id, half } }))
              },
              drop: (half: 'before' | 'after') => {
                /* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
                if (drag === null) return
                commitSessionDrag(drag, { id: node.id, half })
              },
              end: () => {
                if (drag?.over !== null && drag?.over !== undefined) commitSessionDrag(drag, drag.over)
                else setDrag(null)
                sessionDropCommitted.current = false
              },
            }
          }
          return (
          // Group section: header row + expanded top-level session rows. The
          // inter-group breathing room is the section's own margin
          // (WorkspaceBrowser.module.css).
            <div
              key={group.key}
              className={clsx(
                css.groupSection,
                workspaceMarker === 'before' && css.workspaceDropBefore,
                workspaceMarker === 'after' && css.workspaceDropAfter,
              )}
              onDragOver={workspaceDrag === null || hoverWorkspace === undefined
                ? undefined
                : (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  hoverWorkspace(workspaceGroupHalf(e))
                }}
              onDrop={workspaceDrag === null || dropWorkspace === undefined
                ? undefined
                : (e) => {
                  e.preventDefault()
                  dropWorkspace(workspaceGroupHalf(e))
                }}
            >
              <ProjectRowItem
                group={group}
                home={home}
                t={t}
                onToggle={() => {
                  if (group.expanded) {
                    setSessionOverflowByAccount((currentLimits) => {
                      if (!(group.key in currentLimits)) return currentLimits
                      return Object.fromEntries(
                        Object.entries(currentLimits).filter(([key]) => key !== group.key),
                      )
                    })
                  }
                  setGroupExpanded(group.key, !group.expanded)
                }}
                onCreate={() => {
                  if (group.workspaceId !== undefined) {
                    setGroupExpanded(group.key, true)
                    startSession(group.workspaceId)
                  }
                }}
                drag={group.key === UNGROUPED_KEY ? undefined : workspaceDragProps}
                actions={group.key === UNGROUPED_KEY || group.workspaceId === undefined
                  ? undefined
                  : {
                    rename: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onRenameRequest(group.workspaceId, group.label)
                    },
                    addFolder: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onAddFolderRequest(group.workspaceId)
                    },
                    removeFolder: (path) => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onRemoveFolderRequest(group.workspaceId, path)
                    },
                    hide: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onHideRequest(group.workspaceId)
                    },
                    delete: () => {
                    /* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
                      if (group.workspaceId !== undefined) onDeleteRequest(group.workspaceId, group.label)
                    },
                  }}
              />
              {activityLayout === 'folders'
                ? folderSections.map((section) => {
                  const foldKey = activityExpansionKey(group.key, section.bucket)
                  const sectionExpanded = activityExpansion[foldKey] !== false
                  const historyLimit = section.bucket === 'history'
                    ? resolvedSessionOverflowLimit(sessionOverflowByAccount[group.key], sessionOverflowLimit)
                    : null
                  const collapsedHistory = collapsedSessionRows(section.sessions, historyLimit)
                  const visible = collapsedHistory.rows
                  return (
                    <div key={section.bucket} className={css.activitySection}>
                      <ActivitySectionHeading
                        bucket={section.bucket}
                        count={section.sessions.length}
                        expanded={sectionExpanded}
                        onToggle={() => { setActivityExpanded(foldKey, !sectionExpanded) }}
                        t={t}
                      />
                      <div
                        className={clsx(css.activityBody, !sectionExpanded && css.activityBodyCollapsed)}
                        aria-hidden={!sectionExpanded}
                      >
                        <div className={css.activityBodyInner}>
                          {visible.map(node => (
                            <SessionNodeItem
                              key={node.id}
                              node={node}
                              currentId={current}
                              now={now}
                              onOpen={open}
                              onRename={onSessionRename}
                              onFork={forkSession}
                              onArchive={onSessionArchive}
                              onPin={onSessionPin}
                              onUnpin={onSessionUnpin}
                              onMarkUnread={markUnread}
                              onSplit={openSplit}
                              onRevealPath={(path) => { void openPath(path) }}
                              onRevealRow={node.id === revealSessionId
                                ? () => { onSessionRevealed(node.id) }
                                : undefined}
                              drag={sessionDragProps(node)}
                              t={t}
                            />
                          ))}
                          {section.bucket === 'history' && (
                            <SessionOverflowControls
                              t={t}
                              hiddenCount={collapsedHistory.hiddenCount}
                              ordinaryCount={collapsedHistory.ordinaryCount}
                              overflowStep={overflowStep}
                              visibleLimit={historyLimit}
                              canCollapse={sessionOverflowCanCollapse(
                                sessionOverflowByAccount[group.key],
                                sessionOverflowLimit,
                              )}
                              tabIndex={sectionExpanded ? undefined : -1}
                              onExpand={() => {
                                if (historyLimit === null || overflowStep === null) return
                                setSessionOverflowByAccount(currentLimits => ({
                                  ...currentLimits,
                                  [group.key]: nextSessionOverflowLimit(
                                    historyLimit,
                                    overflowStep,
                                    collapsedHistory.ordinaryCount,
                                  ),
                                }))
                              }}
                              onCollapse={() => {
                                setSessionOverflowByAccount((currentLimits) => {
                                  if (!(group.key in currentLimits)) return currentLimits
                                  return Object.fromEntries(
                                    Object.entries(currentLimits).filter(([key]) => key !== group.key),
                                  )
                                })
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
                : (
                  <div className={css.activitySection}>
                    <div className={css.activityBodyInner}>
                      {inlineVisible.map(node => (
                        <SessionNodeItem
                          key={node.id}
                          node={node}
                          currentId={current}
                          now={now}
                          onOpen={open}
                          onRename={onSessionRename}
                          onFork={forkSession}
                          onArchive={onSessionArchive}
                          onPin={onSessionPin}
                          onUnpin={onSessionUnpin}
                          onMarkUnread={markUnread}
                          onSplit={openSplit}
                          onRevealPath={(path) => { void openPath(path) }}
                          onRevealRow={node.id === revealSessionId
                            ? () => { onSessionRevealed(node.id) }
                            : undefined}
                          drag={sessionDragProps(node)}
                          t={t}
                        />
                      ))}
                      <SessionOverflowControls
                        t={t}
                        hiddenCount={collapsedIdle.hiddenCount}
                        ordinaryCount={collapsedIdle.ordinaryCount}
                        overflowStep={overflowStep}
                        visibleLimit={idleLimit}
                        canCollapse={sessionOverflowCanCollapse(
                          sessionOverflowByAccount[group.key],
                          sessionOverflowLimit,
                        )}
                        onExpand={() => {
                          if (idleLimit === null || overflowStep === null) return
                          setSessionOverflowByAccount(currentLimits => ({
                            ...currentLimits,
                            [group.key]: nextSessionOverflowLimit(
                              idleLimit,
                              overflowStep,
                              collapsedIdle.ordinaryCount,
                            ),
                          }))
                        }}
                        onCollapse={() => {
                          setSessionOverflowByAccount((currentLimits) => {
                            if (!(group.key in currentLimits)) return currentLimits
                            return Object.fromEntries(
                              Object.entries(currentLimits).filter(([key]) => key !== group.key),
                            )
                          })
                        }}
                      />
                    </div>
                  </div>
                )}
            </div>
          )
        })}
        {hiddenGroups.length > 0 && (
          <div className={clsx(css.activitySection, css.hiddenSection)}>
            <ActivitySectionHeading
              bucket="history"
              count={hiddenGroups.length}
              expanded={groupExpansion[HIDDEN_SECTION_KEY] === true}
              onToggle={() => {
                setGroupExpanded(HIDDEN_SECTION_KEY, groupExpansion[HIDDEN_SECTION_KEY] !== true)
              }}
              t={t}
              label={t('section.hidden')}
            />
            {groupExpansion[HIDDEN_SECTION_KEY] === true && hiddenGroups.map((group) => {
              const clusters = partitionLiveIdle(group.sessions)
              const idleLimit = resolvedSessionOverflowLimit(sessionOverflowByAccount[group.key], sessionOverflowLimit)
              const collapsedIdle = collapsedSessionRows(clusters.idle, idleLimit)
              const visibleIdle = collapsedIdle.rows
              const inlineVisible = [...clusters.live, ...visibleIdle]
              const folderSections = partitionSessionActivity(group.sessions)
                .filter(section => section.bucket !== 'pinned' && section.sessions.length > 0)
              return (
                <div key={group.key} className={css.groupSection}>
                  <ProjectRowItem
                    group={group}
                    t={t}
                    onToggle={() => {
                      if (group.expanded) {
                        setSessionOverflowByAccount((currentLimits) => {
                          if (!(group.key in currentLimits)) return currentLimits
                          return Object.fromEntries(
                            Object.entries(currentLimits).filter(([key]) => key !== group.key),
                          )
                        })
                      }
                      setGroupExpanded(group.key, !group.expanded)
                    }}
                    onCreate={() => {
                      if (group.workspaceId !== undefined) {
                        setGroupExpanded(HIDDEN_SECTION_KEY, true)
                        setGroupExpanded(group.key, true)
                        startSession(group.workspaceId)
                      }
                    }}
                    actions={group.workspaceId === undefined
                      ? undefined
                      : {
                        show: () => {
                          /* v8 ignore next -- narrowing guard: Hidden rows always have a Workspace id. */
                          if (group.workspaceId !== undefined) onShowRequest(group.workspaceId)
                        },
                        delete: () => {
                          /* v8 ignore next -- narrowing guard: Hidden rows always have a Workspace id. */
                          if (group.workspaceId !== undefined) onDeleteRequest(group.workspaceId, group.label)
                        },
                      }}
                  />
                  {activityLayout === 'folders'
                    ? folderSections.map((section) => {
                      const foldKey = activityExpansionKey(group.key, section.bucket)
                      const sectionExpanded = activityExpansion[foldKey] !== false
                      const historyLimit = section.bucket === 'history'
                        ? resolvedSessionOverflowLimit(sessionOverflowByAccount[group.key], sessionOverflowLimit)
                        : null
                      const collapsedHistory = collapsedSessionRows(section.sessions, historyLimit)
                      const visible = collapsedHistory.rows
                      return (
                        <div key={section.bucket} className={css.activitySection}>
                          <ActivitySectionHeading
                            bucket={section.bucket}
                            count={section.sessions.length}
                            expanded={sectionExpanded}
                            onToggle={() => { setActivityExpanded(foldKey, !sectionExpanded) }}
                            t={t}
                          />
                          <div
                            className={clsx(css.activityBody, !sectionExpanded && css.activityBodyCollapsed)}
                            aria-hidden={!sectionExpanded}
                          >
                            <div className={css.activityBodyInner}>
                              {visible.map(node => (
                                <SessionNodeItem
                                  key={node.id}
                                  node={node}
                                  currentId={current}
                                  now={now}
                                  onOpen={open}
                                  onRename={onSessionRename}
                                  onFork={forkSession}
                                  onArchive={onSessionArchive}
                                  onPin={onSessionPin}
                                  onUnpin={onSessionUnpin}
                                  onMarkUnread={markUnread}
                                  onSplit={openSplit}
                                  onRevealPath={(path) => { void openPath(path) }}
                                  onRevealRow={node.id === revealSessionId
                                    ? () => { onSessionRevealed(node.id) }
                                    : undefined}
                                  t={t}
                                />
                              ))}
                              {section.bucket === 'history' && (
                                <SessionOverflowControls
                                  t={t}
                                  hiddenCount={collapsedHistory.hiddenCount}
                                  ordinaryCount={collapsedHistory.ordinaryCount}
                                  overflowStep={overflowStep}
                                  visibleLimit={historyLimit}
                                  canCollapse={sessionOverflowCanCollapse(
                                    sessionOverflowByAccount[group.key],
                                    sessionOverflowLimit,
                                  )}
                                  tabIndex={sectionExpanded ? undefined : -1}
                                  onExpand={() => {
                                    if (historyLimit === null || overflowStep === null) return
                                    setSessionOverflowByAccount(currentLimits => ({
                                      ...currentLimits,
                                      [group.key]: nextSessionOverflowLimit(
                                        historyLimit,
                                        overflowStep,
                                        collapsedHistory.ordinaryCount,
                                      ),
                                    }))
                                  }}
                                  onCollapse={() => {
                                    setSessionOverflowByAccount((currentLimits) => {
                                      if (!(group.key in currentLimits)) return currentLimits
                                      return Object.fromEntries(
                                        Object.entries(currentLimits).filter(([key]) => key !== group.key),
                                      )
                                    })
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                    : (
                      <div className={css.activitySection}>
                        <div className={css.activityBodyInner}>
                          {inlineVisible.map(node => (
                            <SessionNodeItem
                              key={node.id}
                              node={node}
                              currentId={current}
                              now={now}
                              onOpen={open}
                              onRename={onSessionRename}
                              onFork={forkSession}
                              onArchive={onSessionArchive}
                              onPin={onSessionPin}
                              onUnpin={onSessionUnpin}
                              onMarkUnread={markUnread}
                              onSplit={openSplit}
                              onRevealPath={(path) => { void openPath(path) }}
                              onRevealRow={node.id === revealSessionId
                                ? () => { onSessionRevealed(node.id) }
                                : undefined}
                              t={t}
                            />
                          ))}
                          <SessionOverflowControls
                            t={t}
                            hiddenCount={collapsedIdle.hiddenCount}
                            ordinaryCount={collapsedIdle.ordinaryCount}
                            overflowStep={overflowStep}
                            visibleLimit={idleLimit}
                            canCollapse={sessionOverflowCanCollapse(
                              sessionOverflowByAccount[group.key],
                              sessionOverflowLimit,
                            )}
                            onExpand={() => {
                              if (idleLimit === null || overflowStep === null) return
                              setSessionOverflowByAccount(currentLimits => ({
                                ...currentLimits,
                                [group.key]: nextSessionOverflowLimit(
                                  idleLimit,
                                  overflowStep,
                                  collapsedIdle.ordinaryCount,
                                ),
                              }))
                            }}
                            onCollapse={() => {
                              setSessionOverflowByAccount((currentLimits) => {
                                if (!(group.key in currentLimits)) return currentLimits
                                return Object.fromEntries(
                                  Object.entries(currentLimits).filter(([key]) => key !== group.key),
                                )
                              })
                            }}
                          />
                        </div>
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <span className={css.fade} />
    </div>
  )
}

/** The flat "In one list" body: every session is one draggable top-level row. */
function FlatList({
  useSessions, useSessionPendingInteraction, open, forkSession, onSessionRename, onSessionArchive,
  revealSessionId, onSessionRevealed,
  onSessionPin, onSessionUnpin, markUnread, openPath, openSplit, pinnedSessionIds, archivedSessionIds,
  orderBy, activityLayout, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder,
  activityExpansion, setActivityExpanded, t, sessionOverflowLimit,
}: Pick<
  SessionTreeProps,
  | 'useSessions'
  | 'useSessionPendingInteraction'
  | 'open'
  | 'forkSession'
  | 'onSessionRename'
  | 'onSessionArchive'
  | 'onSessionPin'
  | 'onSessionUnpin'
  | 'markUnread'
  | 'openPath'
  | 'openSplit'
  | 'pinnedSessionIds'
  | 'archivedSessionIds'
  | 'orderBy'
  | 'activityLayout'
  | 'sessionOrderByAccount'
  | 'sessionUpdatedAtByAccount'
  | 'syncSessionOrderAccount'
  | 'setSessionOrder'
  | 'activityExpansion'
  | 'setActivityExpanded'
  | 'revealSessionId'
  | 'onSessionRevealed'
  | 't'
  | 'sessionOverflowLimit'
>) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const baseRows = useMemo(
    () => deriveFlat(list, archivedSessionIds, pendingInteractions),
    [list, archivedSessionIds, pendingInteractions],
  )
  const sessionIds = useMemo(() => baseRows.map(row => row.id), [baseRows])
  const previousOrderBy = useRef(orderBy)
  useEffect(() => {
    if (list.phase !== 'ready') return
    const previousOrder = sessionOrderByAccount[FLAT_SESSION_ORDER_KEY]
    const previousUpdatedAt = sessionUpdatedAtByAccount[FLAT_SESSION_ORDER_KEY] ?? {}
    const switchedToUpdated = previousOrderBy.current !== 'updated' && orderBy === 'updated'
    previousOrderBy.current = orderBy
    const next = nextSessionOrderAccount({
      sessionIds,
      previousOrder,
      previousUpdatedAt,
      list,
      orderBy,
      sortByRecency: orderBy === 'updated' && (previousOrder === undefined || switchedToUpdated),
    })
    if (next.changed) {
      syncSessionOrderAccount(FLAT_SESSION_ORDER_KEY, next.order.map(id => id as string), next.updatedAt)
    }
  }, [list, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, sessionIds, syncSessionOrderAccount])
  const rows = useMemo(() => {
    const pinned = new Set(pinnedSessionIds)
    const byId = new Map(baseRows.map(row => [row.id, row]))
    return reconciledSessionOrder(sessionIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY])
      .flatMap((id) => {
        if (pinned.has(id)) return []
        const row = byId.get(id)
        return row === undefined ? [] : [row]
      })
  }, [baseRows, pinnedSessionIds, sessionOrderByAccount, sessionIds])
  const pinnedRows = useMemo(() => {
    const byId = new Map(baseRows.map(row => [row.id as string, row]))
    return pinnedSessionIds.flatMap((id) => {
      const session = byId.get(id)
      return session === undefined ? [] : [{ ...session, pinned: true as const }]
    })
  }, [baseRows, pinnedSessionIds])
  const [drag, setDrag] = useState<DragState | null>(null)
  const dropCommitted = useRef(false)
  const [flatOverflowLimit, setFlatOverflowLimit] = useState<number | undefined>(undefined)
  const overflowStep = sessionOverflowStep(sessionOverflowLimit)
  const flatVisibleLimit = resolvedSessionOverflowLimit(flatOverflowLimit, sessionOverflowLimit)
  useNativeDragAcceptance(drag !== null)
  const clusters = useMemo(() => partitionLiveIdle(rows), [rows])
  const collapsedIdle = collapsedSessionRows(clusters.idle, flatVisibleLimit)
  const visibleIdle = collapsedIdle.rows
  const inlineVisible = [...clusters.live, ...visibleIdle]
  const folderSections = useMemo(
    () => partitionSessionActivity(rows).filter(section => section.bucket !== 'pinned' && section.sessions.length > 0),
    [rows],
  )
  const commitDrag = (activeDrag: DragState, over: NonNullable<DragState['over']>): void => {
    if (dropCommitted.current) return
    dropCommitted.current = true
    setDrag(null)
    const neighbors = dragNeighbors(rows, activityLayout, activeDrag)
    const targetIndex = neighbors.findIndex(row => row.id === over.id)
    if (targetIndex === -1) return
    const remaining = neighbors.filter(row => row.id !== activeDrag.sessionId)
    const anchor = over.half === 'before' ? over.id : neighbors[targetIndex + 1]?.id
    if (anchor === activeDrag.sessionId) return
    const sourceIndex = neighbors.findIndex(row => row.id === activeDrag.sessionId)
    const remainingAnchor = anchor === undefined
      ? neighbors.length
      : neighbors.findIndex(row => row.id === anchor)
    if (sourceIndex !== -1 && (remainingAnchor === sourceIndex || remainingAnchor === sourceIndex + 1)) return
    const nextOrder = rows.map(row => row.id).filter(id => id !== activeDrag.sessionId)
    const insertAt = anchor === undefined
      ? (() => {
        const lastNeighbor = remaining.at(-1)?.id
        return lastNeighbor === undefined ? nextOrder.length : nextOrder.indexOf(lastNeighbor) + 1
      })()
      : nextOrder.indexOf(anchor)
    nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId)
    setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder.map(id => id as string))
  }
  const now = Date.now()
  const sessionDragProps = (node: SessionNode) => {
    const bucket = sessionActivityBucket(node)
    const cluster = sessionListCluster(node)
    const active = drag !== null && (activityLayout === 'folders' ? drag.bucket === bucket : drag.cluster === cluster)
    return {
      start: () => {
        dropCommitted.current = false
        setDrag({
          accountKey: FLAT_SESSION_ORDER_KEY,
          sessionId: node.id,
          cluster,
          bucket,
          over: null,
        })
      },
      active,
      marker: active && drag.over?.id === node.id ? drag.over.half : null,
      hover: (half: 'before' | 'after') => {
        setDrag(current => current === null ? current : { ...current, over: { id: node.id, half } })
      },
      drop: (half: 'before' | 'after') => {
        if (drag !== null) commitDrag(drag, { id: node.id, half })
      },
      end: () => {
        if (drag?.over !== null && drag?.over !== undefined) commitDrag(drag, drag.over)
        else setDrag(null)
        dropCommitted.current = false
      },
    }
  }
  return (
    <div className={clsx(css.treeBody, css.wide)}>
      <div className={clsx(css.list, css.flatList)} role="tree" aria-label={t('section.sessions')}>
        {rows.length === 0 && pinnedRows.length === 0 && (
          <div className={css.empty}>{t('empty.none')}</div>
        )}
        {pinnedRows.length > 0 && (
          <div className={css.activitySection}>
            <ActivitySectionHeading
              bucket="pinned"
              count={pinnedRows.length}
              expanded={activityExpansion[PINNED_EXPANSION_KEY] !== false}
              onToggle={() => {
                setActivityExpanded(
                  PINNED_EXPANSION_KEY,
                  activityExpansion[PINNED_EXPANSION_KEY] === false,
                )
              }}
              t={t}
            />
            <div
              className={clsx(
                css.activityBody,
                activityExpansion[PINNED_EXPANSION_KEY] === false && css.activityBodyCollapsed,
              )}
              aria-hidden={activityExpansion[PINNED_EXPANSION_KEY] === false}
            >
              <div className={css.activityBodyInner}>
                {pinnedRows.map(node => (
                  <SessionNodeItem
                    key={node.id}
                    node={node}
                    currentId={list.current}
                    now={now}
                    onOpen={open}
                    onRename={onSessionRename}
                    onFork={forkSession}
                    onArchive={onSessionArchive}
                    onPin={onSessionPin}
                    onUnpin={onSessionUnpin}
                    onMarkUnread={markUnread}
                    onSplit={openSplit}
                    onRevealPath={(path) => { void openPath(path) }}
                    onRevealRow={node.id === revealSessionId
                      ? () => { onSessionRevealed(node.id) }
                      : undefined}
                    flat
                    t={t}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {rows.length > 0 && activityLayout === 'folders' && folderSections.map((section) => {
          const foldKey = activityExpansionKey(FLAT_SESSION_ORDER_KEY, section.bucket)
          const sectionExpanded = activityExpansion[foldKey] !== false
          const historyLimit = section.bucket === 'history' ? flatVisibleLimit : null
          const collapsedHistory = collapsedSessionRows(section.sessions, historyLimit)
          const visible = collapsedHistory.rows
          return (
            <div key={section.bucket} className={css.activitySection}>
              <ActivitySectionHeading
                bucket={section.bucket}
                count={section.sessions.length}
                expanded={sectionExpanded}
                onToggle={() => { setActivityExpanded(foldKey, !sectionExpanded) }}
                t={t}
              />
              <div
                className={clsx(css.activityBody, !sectionExpanded && css.activityBodyCollapsed)}
                aria-hidden={!sectionExpanded}
              >
                <div className={css.activityBodyInner}>
                  {visible.map(node => (
                    <SessionNodeItem
                      key={node.id}
                      node={node}
                      currentId={list.current}
                      now={now}
                      onOpen={open}
                      onRename={onSessionRename}
                      onFork={forkSession}
                      onArchive={onSessionArchive}
                      onPin={onSessionPin}
                      onUnpin={onSessionUnpin}
                      onMarkUnread={markUnread}
                      onSplit={openSplit}
                      onRevealPath={(path) => { void openPath(path) }}
                      onRevealRow={node.id === revealSessionId
                        ? () => { onSessionRevealed(node.id) }
                        : undefined}
                      flat
                      drag={sessionDragProps(node)}
                      t={t}
                    />
                  ))}
                  {section.bucket === 'history' && (
                    <SessionOverflowControls
                      t={t}
                      hiddenCount={collapsedHistory.hiddenCount}
                      ordinaryCount={collapsedHistory.ordinaryCount}
                      overflowStep={overflowStep}
                      visibleLimit={historyLimit}
                      canCollapse={sessionOverflowCanCollapse(flatOverflowLimit, sessionOverflowLimit)}
                      tabIndex={sectionExpanded ? undefined : -1}
                      onExpand={() => {
                        if (historyLimit === null || overflowStep === null) return
                        setFlatOverflowLimit(nextSessionOverflowLimit(
                          historyLimit,
                          overflowStep,
                          collapsedHistory.ordinaryCount,
                        ))
                      }}
                      onCollapse={() => { setFlatOverflowLimit(undefined) }}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {rows.length > 0 && activityLayout === 'inline' && (
          <div className={css.activitySection}>
            <div className={css.activityBodyInner}>
              {inlineVisible.map(node => (
                <SessionNodeItem
                  key={node.id}
                  node={node}
                  currentId={list.current}
                  now={now}
                  onOpen={open}
                  onRename={onSessionRename}
                  onFork={forkSession}
                  onArchive={onSessionArchive}
                  onPin={onSessionPin}
                  onUnpin={onSessionUnpin}
                  onMarkUnread={markUnread}
                  onSplit={openSplit}
                  onRevealPath={(path) => { void openPath(path) }}
                  onRevealRow={node.id === revealSessionId
                    ? () => { onSessionRevealed(node.id) }
                    : undefined}
                  flat
                  drag={sessionDragProps(node)}
                  t={t}
                />
              ))}
              <SessionOverflowControls
                t={t}
                hiddenCount={collapsedIdle.hiddenCount}
                ordinaryCount={collapsedIdle.ordinaryCount}
                overflowStep={overflowStep}
                visibleLimit={flatVisibleLimit}
                canCollapse={sessionOverflowCanCollapse(flatOverflowLimit, sessionOverflowLimit)}
                onExpand={() => {
                  if (flatVisibleLimit === null || overflowStep === null) return
                  setFlatOverflowLimit(nextSessionOverflowLimit(
                    flatVisibleLimit,
                    overflowStep,
                    collapsedIdle.ordinaryCount,
                  ))
                }}
                onCollapse={() => { setFlatOverflowLimit(undefined) }}
              />
            </div>
          </div>
        )}
      </div>
      <span className={css.fade} />
    </div>
  )
}

interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly SessionSearchResultItem[]
  hasMore: boolean
}

/** Flat search body: local metadata matches plus the current Host result page. */
function SearchResults({
  useSessions,
  useSessionPendingInteraction,
  open,
  workspaces,
  archivedSessionIds,
  query,
  remote,
  resultLimit,
  t,
}: Pick<SessionTreeProps, 'useSessions' | 'useSessionPendingInteraction' | 'open' | 't'> & {
  workspaces: readonly WorkspaceView[]
  archivedSessionIds: readonly SessionNode['id'][]
  query: string
  remote: RemoteSearchState
  resultLimit: number
}) {
  const list = useSessions(s => s)
  const pendingInteractions = useSessionPendingInteraction(s => s)
  const currentRemote = remote.query === query
    ? remote
    : { query, status: 'loading' as const, items: [], hasMore: false }
  const results = useMemo(
    () => deriveSearchResults(
      list,
      workspaces,
      query,
      archivedSessionIds,
      pendingInteractions,
      currentRemote,
      resultLimit,
    ),
    [list, workspaces, query, archivedSessionIds, pendingInteractions, currentRemote, resultLimit],
  )
  const pending = currentRemote.status === 'loading'
  const failed = currentRemote.status === 'error'

  return (
    <div className={clsx(css.treeBody, css.wide)}>
      <div className={css.list}>
        <div className={css.searchTree} role="tree" aria-label={t('search.results.aria')}>
          {results.items.map(result => (
            <SearchResultItem
              key={result.id}
              result={result}
              currentId={list.current}
              onOpen={open}
              t={t}
            />
          ))}
        </div>
        {pending && (
          <div className={css.searchStatus} role="status">{t('search.pending')}</div>
        )}
        {failed && (
          <div className={css.searchWarning} role="status">
            {t('search.unavailable')}
          </div>
        )}
        {!pending && results.items.length === 0 && (
          <div className={css.empty}>{t('search.noMatches')}</div>
        )}
        {results.hasMore && (
          <div className={css.searchStatus}>
            {t('search.hasMore', { n: resultLimit })}
          </div>
        )}
      </div>
      <span className={css.fade} />
    </div>
  )
}

/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export function WorkspaceBrowser({
  wide,
  expandSidebar,
  useSessions,
  useSessionPendingInteraction,
  useWorkspaces,
  useStore,
  actions,
  startSession,
  open,
  renameSession,
  forkSession,
  renameWorkspace,
  deleteWorkspace,
  insertWorkspaceBefore,
  archiveSession,
  insertSessionBefore,
  createWorkspace,
  markUnread,
  openPath,
  openSplit,
  hideWorkspace,
  showWorkspace,
  addWorkspaceFolder,
  removeWorkspaceFolder,
  searchSessions,
  searchResultLimit,
  useDirectoryFlow,
  useSessionOverflowLimit,
  useHostInfo,
  renderSlot,
  t,
}: WorkspaceBrowserProps) {
  const home = useHostInfo(info => info.home)
  const workspaces = useWorkspaces(state => state.items)
  const workspacePhase = useWorkspaces(state => state.phase)
  const workspaceStreamState = useWorkspaces(state => state.state)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const hiddenWorkspaceIds = useWorkspaces(state => state.hiddenWorkspaceIds)
  // Live occupancy of this surface's directory-flow hole (the same source the
  // flow reads): a composition without a picking affordance can add nothing.
  const directoryFlowAvailable = useDirectoryFlow(occupied => occupied)
  const groupBy = useStore(s => s.groupBy)
  const orderBy = useStore(s => s.orderBy)
  const activityLayout = useStore(s => s.activityLayout === 'inline' ? 'inline' : 'folders')
  const emptyWorkspaces = useStore(s => s.emptyWorkspaces === 'hide' ? 'hide' : 'show')
  const groupExpansion = useStore(s => s.groupExpansion)
  const sessionOrderByAccount = useStore(s => s.sessionOrderByAccount)
  const sessionUpdatedAtByAccount = useStore(s => s.sessionUpdatedAtByAccount)
  const activityExpansion = useStore(s => s.activityExpansion)
  const pinnedSessionIds = useStore(s => s.pinnedSessionIds)
  const sessionOverflowLimit = useSessionOverflowLimit(value => value)
  const pinSession = (sessionId: SessionNode['id']) => {
    actions.pinSession(sessionId as string)
  }
  const unpinSession = (sessionId: SessionNode['id']) => {
    actions.unpinSession(sessionId as string)
  }
  const currentBlankSessionId = useSessions((state) => {
    const current = state.current
    return current !== undefined && state.byId[current]?.blank === true ? current : undefined
  })
  const currentBlankAccount = currentBlankSessionId === undefined
    || workspacePhase !== 'ready'
    ? undefined
    : owningGroupKey(workspaces, currentBlankSessionId)
  const promotedBlank = useRef<{ sessionId: SessionId; accountKey: string } | undefined>(undefined)
  useEffect(() => {
    if (currentBlankSessionId === undefined || currentBlankAccount === undefined) {
      promotedBlank.current = undefined
      return
    }
    const promoted = promotedBlank.current
    if (promoted !== undefined && promoted.sessionId === currentBlankSessionId
      && promoted.accountKey === currentBlankAccount) return
    promotedBlank.current = { sessionId: currentBlankSessionId, accountKey: currentBlankAccount }
    for (const accountKey of new Set([currentBlankAccount, FLAT_SESSION_ORDER_KEY])) {
      const previous = sessionOrderByAccount[accountKey] ?? []
      actions.setSessionOrder(accountKey, [
        currentBlankSessionId,
        ...previous.filter(id => id !== currentBlankSessionId),
      ])
    }
  }, [actions.setSessionOrder, currentBlankAccount, currentBlankSessionId, sessionOrderByAccount])
  useEffect(() => {
    if (workspacePhase !== 'ready') return
    actions.retainAccountKeys([
      UNGROUPED_KEY,
      FLAT_SESSION_ORDER_KEY,
      HIDDEN_SECTION_KEY,
      ...workspaces.map(workspace => workspace.workspaceId as string),
    ])
  }, [actions.retainAccountKeys, workspacePhase, workspaces])
  // The query outlives the tree and the input (both wide-only) so collapsing
  // does not silently drop an in-progress filter.
  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [revealSessionId, setRevealSessionId] = useState<SessionId | undefined>(undefined)
  const normalizedQuery = sanitizeSearchQuery(query).trim()
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({
    query: '',
    status: 'idle',
    items: [],
    hasMore: false,
  })
  const searchRoot = useRef<HTMLDivElement | null>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)
  // Section-header ＋ opens the picker menu (same popover in wide and rail
  // states; the menu anchors on this button).
  const [wsPickerOpen, setWsPickerOpen] = useState(false)
  const [folderTarget, setFolderTarget] = useState<WorkspaceId | null>(null)
  const wsPlusRef = useRef<HTMLButtonElement>(null)
  const composingRef = useRef(false)

  const openSearchResult = (sessionId: SessionId): void => {
    setRevealSessionId(sessionId)
    setQuery('')
    setSearchExpanded(false)
    open(sessionId)
  }
  const acknowledgeSessionReveal = (sessionId: SessionId): void => {
    setRevealSessionId(current => current === sessionId ? undefined : current)
  }
  useEffect(() => {
    if (normalizedQuery !== '') setRevealSessionId(undefined)
  }, [normalizedQuery])

  // Rail search = expand + land in the search box: the flag arms before the
  // expand request; once the shell flips wide the input mounts and takes focus.
  const [searchOnExpand, setSearchOnExpand] = useState(false)
  useEffect(() => {
    if (wide && searchOnExpand) {
      const timer = window.setTimeout(() => {
        searchInput.current?.focus({ preventScroll: true })
        setSearchOnExpand(false)
      }, EXPAND_SLIDE_MS)
      return () => { window.clearTimeout(timer) }
    }
  }, [wide, searchOnExpand])

  useEffect(() => {
    if (!wide || !searchExpanded || searchOnExpand) return
    searchInput.current?.focus({ preventScroll: true })
  }, [wide, searchExpanded, searchOnExpand])

  // Outside-click dismissal stays off while the rail gesture is in flight
  // (searchOnExpand): the rail click flips the shell wide and mounts this
  // listener during its own dispatch, then keeps bubbling to document with
  // the now-unmounted rail button as its target — outside searchRoot, so the
  // listener would dismiss the search that click just opened.
  useEffect(() => {
    if (!wide || !searchExpanded || searchOnExpand) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return
      searchInput.current?.blur()
      if (normalizedQuery !== '') return
      setSearchExpanded(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [normalizedQuery, wide, searchExpanded, searchOnExpand])

  useEffect(() => {
    if (normalizedQuery === '') {
      setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemoteSearch({
      query: normalizedQuery,
      status: 'loading',
      items: [],
      hasMore: false,
    })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: normalizedQuery,
          status: 'ready',
          items: result.items,
          hasMore: result.hasMore,
        })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemoteSearch({
          query: normalizedQuery,
          status: 'error',
          items: [],
          hasMore: false,
        })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Rename dialog (browser-owned so it outlives row unmounts during collapse).
  const [renameTarget, setRenameTarget] = useState<{ workspaceId: WorkspaceId; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
    && workspaces.some(w => w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === ''
    || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate
  const closeRename = () => {
    if (renaming) return
    setRenameTarget(null)
    setRenameError(null)
  }
  const confirmRename = () => {
    if (renameBlocked) return
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Session rename dialog (same browser-owned pattern as workspace rename;
  // sessions have no client-side name-conflict rule — the host normalizes).
  // Unlike workspace rename, an unchanged title is NOT blocked: confirming
  // the current automatic title is the gesture that pins it.
  const [sessionRenameTarget, setSessionRenameTarget] = useState<{ sessionId: SessionNode['id']; currentTitle: string } | null>(null)
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionRenameError, setSessionRenameError] = useState<string | null>(null)
  const sessionRenameTrimmed = sessionRenameDraft.trim()
  const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === '' || sessionRenameTarget === null
  const closeSessionRename = () => {
    if (sessionRenaming) return
    setSessionRenameTarget(null)
    setSessionRenameError(null)
  }
  const confirmSessionRename = () => {
    if (sessionRenameBlocked) return
    setSessionRenaming(true)
    setSessionRenameError(null)
    renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
      setSessionRenaming(false)
      setSessionRenameTarget(null)
    }).catch((reason: unknown) => {
      setSessionRenaming(false)
      setSessionRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onSessionRename = (sessionId: SessionNode['id'], currentTitle: string) => {
    setSessionRenameTarget({ sessionId, currentTitle })
    setSessionRenameDraft(currentTitle)
    setSessionRenameError(null)
  }

  // Archive is dialog-free: not destructive (the log and the accounting slot
  // remain), so the menu action commits directly; the row disappears when the
  // archive-set echo lands. Failures are non-fatal console diagnostics, the
  // same posture as reorder rejections.
  const onSessionArchive = (sessionId: SessionNode['id']) => {
    archiveSession(sessionId).catch((reason: unknown) => {
      console.warn('session archive rejected:', reason)
    })
  }

  const onHideWorkspace = (workspaceId: WorkspaceId) => {
    hideWorkspace(workspaceId).catch((reason: unknown) => {
      console.warn('workspace hide rejected:', reason)
    })
  }

  const onShowWorkspace = (workspaceId: WorkspaceId) => {
    showWorkspace(workspaceId).catch((reason: unknown) => {
      console.warn('workspace show rejected:', reason)
    })
  }

  // Delete dialog is separate from the row so a successful removal can
  // unmount that row without tearing down the in-flight confirmation state.
  const [deleteTarget, setDeleteTarget] = useState<{ workspaceId: WorkspaceId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteCommittedId, setDeleteCommittedId] = useState<WorkspaceId | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  useEffect(() => {
    if (deleteCommittedId === null
      || workspaces.some(workspace => workspace.workspaceId === deleteCommittedId)) return
    setDeleting(false)
    setDeleteCommittedId(null)
    setDeleteTarget(null)
  }, [deleteCommittedId, workspaces])
  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }
  const confirmDelete = () => {
    /* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteCommittedId(null)
    setDeleteError(null)
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      // Keep the confirmation pending until this component has rendered the
      // committed list projection without the deleted id. Closing earlier
      // exposes one stale React frame to the next Create Workspace gesture.
      setDeleteCommittedId(deleteTarget.workspaceId)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return (
    <div className={clsx(css.root, !wide && css.rail)}>
      <div className={css.sectionHeader}>
        {wide && (
          <span className={clsx(css.sectionLabel, css.wide, searchExpanded && css.sectionLabelHidden)}>
            {groupBy === 'flat' ? t('section.sessions') : t('section.workspaces')}
          </span>
        )}
        {wide && (
          <div className={clsx(css.searchSlot, searchExpanded && css.searchSlotExpanded)}>
            <div
              ref={searchRoot}
              className={clsx(css.search, searchExpanded && css.searchExpanded)}
              onClick={() => {
                setWsPickerOpen(false)
                setSearchExpanded(true)
                searchInput.current?.focus()
              }}
            >
              <Tooltip label={t('search')} side="bottom" delayMs={500} disabled={searchExpanded}>
                <button
                  type="button"
                  className={css.searchButton}
                  aria-label={t('search.sessions.aria')}
                  aria-expanded={searchExpanded}
                  onClick={() => {
                    setWsPickerOpen(false)
                    setSearchExpanded(true)
                  }}
                >
                  <IconSearchOutline16 size={searchExpanded ? 11 : 14} />
                </button>
              </Tooltip>
              <input
                ref={searchInput}
                className={css.searchInput}
                type="text"
                placeholder={t('search.placeholder')}
                maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
                value={query}
                tabIndex={searchExpanded ? 0 : -1}
                onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  setQuery('')
                  setSearchExpanded(false)
                }}
              />
              {searchExpanded && (
                <button
                  type="button"
                  className={css.clearButton}
                  aria-label={t('search.clear')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setQuery('')
                    setSearchExpanded(false)
                  }}
                >
                  <IconCloseFill14 />
                </button>
              )}
            </div>
          </div>
        )}
        <div className={clsx(css.headerActions, wide && searchExpanded && css.headerActionsHidden)}>
          {wide && (
            <ViewOptionsMenu
              groupBy={groupBy}
              orderBy={orderBy}
              activityLayout={activityLayout}
              emptyWorkspaces={emptyWorkspaces}
              onGroupPick={(mode) => { actions.setGroupBy(mode) }}
              onOrderPick={(mode) => { actions.setOrderBy(mode) }}
              onActivityLayoutPick={(mode) => { actions.setActivityLayout(mode) }}
              onEmptyWorkspacesPick={(mode) => { actions.setEmptyWorkspaces(mode) }}
              t={t}
            />
          )}
          {/* Adding is the button's one action, so a composition with no
              picking affordance has nothing to offer here: the region hides the
              button rather than leaving a dead one in the header. */}
          {directoryFlowAvailable && (
            <Tooltip label={t('workspace.add')} side="bottom" delayMs={500}>
              <button
                ref={wsPlusRef}
                type="button"
                className={css.iconButton}
                aria-label={t('workspace.add')}
                onClick={() => {
                  setWsPickerOpen(v => !v)
                }}
              >
                <IconProjectAddOutline16 size={wide ? 16 : 18} />
              </button>
            </Tooltip>
          )}
        </div>
        {/* Add flow + its error dialog (same package — direct composition). */}
        <WorkspacePickFlow
          t={t}
          open={wsPickerOpen}
          anchorRef={wsPlusRef}
          useWorkspaces={useWorkspaces}
          createWorkspace={createWorkspace}
          addFolderTo={folderTarget ?? undefined}
          addWorkspaceFolder={addWorkspaceFolder}
          onAddFolderSettled={() => { setFolderTarget(null) }}
          useDirectoryFlow={useDirectoryFlow}
          renderDirectoryFlow={owner => renderSlot('sidebar.workspaces.directoryFlow', owner)}
          addOnly
          side="right"
          onPick={(workspaceId) => {
            const addingFolder = folderTarget !== null
            setWsPickerOpen(false)
            setFolderTarget(null)
            if (!addingFolder) startSession(workspaceId)
          }}
          onClose={() => {
            setWsPickerOpen(false)
          }}
        />
      </div>

      {/* The collapsed rail keeps search as its own 36px control. */}
      {!wide && <div className={css.search}>
        <Tooltip label={t('search')}>
          <button
            type="button"
            className={css.searchButton}
            aria-label={t('search.sessions.aria')}
            onClick={() => {
              setSearchExpanded(true)
              setSearchOnExpand(true)
              expandSidebar()
            }}
          >
            <IconSearchOutline16 size={18} />
          </button>
        </Tooltip>
      </div>}

      {/* Always-mounted seat keeps the region's flex slot while the list
          itself is wide-only. */}
      <div className={css.listArea}>
        {wide && (normalizedQuery !== ''
          ? (
            <SearchResults
              useSessions={useSessions}
              useSessionPendingInteraction={useSessionPendingInteraction}
              open={openSearchResult}
              workspaces={workspaces}
              archivedSessionIds={archivedSessionIds}
              query={normalizedQuery}
              remote={remoteSearch}
              resultLimit={searchResultLimit}
              t={t}
            />
          )
          : groupBy === 'flat'
            ? (
              <FlatList
                useSessions={useSessions} useSessionPendingInteraction={useSessionPendingInteraction}
                open={open} forkSession={forkSession}
                onSessionRename={onSessionRename} onSessionArchive={onSessionArchive}
                onSessionPin={pinSession} onSessionUnpin={unpinSession}
                markUnread={markUnread} openPath={openPath} openSplit={openSplit}
                pinnedSessionIds={pinnedSessionIds}
                archivedSessionIds={archivedSessionIds}
                orderBy={orderBy}
                activityLayout={activityLayout}
                sessionOrderByAccount={sessionOrderByAccount}
                sessionUpdatedAtByAccount={sessionUpdatedAtByAccount}
                syncSessionOrderAccount={actions.syncSessionOrderAccount}
                setSessionOrder={actions.setSessionOrder}
                revealSessionId={revealSessionId}
                onSessionRevealed={acknowledgeSessionReveal}
                activityExpansion={activityExpansion}
                setActivityExpanded={actions.setActivityExpanded}
                sessionOverflowLimit={sessionOverflowLimit}
                t={t}
              />
            )
            : (
              <SessionTree
                useSessions={useSessions}
                useSessionPendingInteraction={useSessionPendingInteraction}
                onSessionRename={onSessionRename}
                onSessionArchive={onSessionArchive}
                onSessionPin={pinSession}
                onSessionUnpin={unpinSession}
                pinnedSessionIds={pinnedSessionIds}
                forkSession={forkSession}
                workspaces={workspaces}
                workspaceReady={workspacePhase === 'ready' && workspaceStreamState !== 'loading'}
                groupExpansion={groupExpansion}
                setGroupExpanded={actions.setGroupExpanded}
                sessionOrderByAccount={sessionOrderByAccount}
                sessionUpdatedAtByAccount={sessionUpdatedAtByAccount}
                syncSessionOrderAccount={actions.syncSessionOrderAccount}
                setSessionOrder={actions.setSessionOrder}
                activityExpansion={activityExpansion}
                setActivityExpanded={actions.setActivityExpanded}
                sessionOverflowLimit={sessionOverflowLimit}
                activityLayout={activityLayout}
                emptyWorkspaces={emptyWorkspaces}
                archivedSessionIds={archivedSessionIds}
                hiddenWorkspaceIds={hiddenWorkspaceIds}
                startSession={startSession}
                open={open}
                markUnread={markUnread}
                openPath={openPath}
                openSplit={openSplit}
                insertWorkspaceBefore={insertWorkspaceBefore}
                insertSessionBefore={insertSessionBefore}
                orderBy={orderBy}
                revealSessionId={revealSessionId}
                onSessionRevealed={acknowledgeSessionReveal}
                home={home}
                t={t}
                onRenameRequest={(workspaceId, currentTitle) => {
                  setRenameTarget({ workspaceId, currentTitle })
                  setRenameDraft(currentTitle)
                  setRenameError(null)
                }}
                onHideRequest={onHideWorkspace}
                onShowRequest={onShowWorkspace}
                onDeleteRequest={(workspaceId, title) => {
                  setDeleteTarget({ workspaceId, title })
                  setDeleteError(null)
                }}
                onAddFolderRequest={(workspaceId) => {
                  setFolderTarget(workspaceId)
                }}
                onRemoveFolderRequest={(workspaceId, path) => {
                  void removeWorkspaceFolder(workspaceId, path)
                }}
              />
            ))}
      </div>

      <Modal
        open={renameTarget !== null}
        onClose={closeRename}
        closeLabel={t('close')}
        title={t('rename.workspace.title')}
        footer={(
          <>
            <Button variant="outline" disabled={renaming} onClick={closeRename}>{t('cancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('rename')}</Button>
          </>
        )}
      >
        <input
          className={css.renameInput}
          value={renameDraft}
          aria-label={t('field.workspaceName')}
          autoFocus
          disabled={renaming}
          onFocus={(e) => { e.target.select() }}
          onChange={(e) => { setRenameDraft(e.target.value); setRenameError(null) }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !composingRef.current) {
              e.preventDefault()
              confirmRename()
            }
          }}
        />
        {renameDuplicate && (
          <div className={css.renameError} role="alert">{t('conflict.named', { name: renameTrimmed })}</div>
        )}
        {renameError !== null && <div className={css.renameError} role="alert">{renameError}</div>}
      </Modal>

      <Modal
        open={sessionRenameTarget !== null}
        onClose={closeSessionRename}
        closeLabel={t('close')}
        title={t('rename.session.title')}
        footer={(
          <>
            <Button variant="outline" disabled={sessionRenaming} onClick={closeSessionRename}>{t('cancel')}</Button>
            <Button variant="primary" disabled={sessionRenameBlocked} onClick={confirmSessionRename}>{t('rename')}</Button>
          </>
        )}
      >
        <input
          className={css.renameInput}
          value={sessionRenameDraft}
          aria-label={t('field.sessionName')}
          autoFocus
          disabled={sessionRenaming}
          onFocus={(e) => { e.target.select() }}
          onChange={(e) => { setSessionRenameDraft(e.target.value); setSessionRenameError(null) }}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !composingRef.current) {
              e.preventDefault()
              confirmSessionRename()
            }
          }}
        />
        {sessionRenameError !== null && <div className={css.renameError} role="alert">{sessionRenameError}</div>}
      </Modal>
      <Modal
        open={deleteTarget !== null}
        onClose={closeDelete}
        closeLabel={t('close')}
        title={t('delete.workspace')}
        {...deleteTarget === null
          ? {}
          : { description: t('delete.desc', { name: deleteTarget.title }) }}
        footer={(
          <>
            <Button variant="outline" disabled={deleting} onClick={closeDelete}>{t('cancel')}</Button>
            <Button
              variant="outline"
              className={css.deleteAction}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {t('delete.workspace')}
            </Button>
          </>
        )}
      >
        {deleting && <div className={css.deleteStatus} role="status">{t('delete.pending')}</div>}
        {deleteError !== null && <div className={css.renameError} role="alert">{deleteError}</div>}
      </Modal>
    </div>
  )
}
