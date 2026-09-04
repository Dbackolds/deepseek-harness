/**
 * Derives the workspace browser tree from Host Workspace order and membership.
 * The Host No Repo workspace is the trailing Chat group; other unassigned
 * Sessions trail under that same Chat bucket. Only the selected blank Session
 * remains visible.
 */
import {
  type SessionListState, type SessionSearchResultItem, type SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {
  SessionPendingInteractionBase,
} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-schedule/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { SessionEmptyWorkspaces } from './stores.ts'
import {
  indexSubagentDescendants, type SubagentDescendantSummary,
} from './subagent-lineage.ts'

/** Group key for Sessions outside every project Workspace (Chat / No Repo). */
export const UNGROUPED_KEY = ''

/** Browser-local expansion account for the trailing Hidden section. */
export const HIDDEN_SECTION_KEY = '__hidden__'

/** Display label for the Chat bucket row (English dictionary source). */
export const UNGROUPED_LABEL = 'Chat'

/**
 * True when a Workspace is the Host No Repo home used for chats that have
 * no project folder. Title match is the Host registration name; path match
 * covers a renamed No Repo whose directory is still `$DSH_HOME/no-repo`.
 * @param workspace - Host Workspace row.
 * @returns whether this Workspace is the Chat bucket.
 */
export function isNoRepoWorkspace(
  workspace: Pick<WorkspaceView, 'title' | 'path'>,
): boolean {
  return workspace.title === 'No Repo'
    || workspace.path.endsWith('/no-repo')
    || workspace.path.endsWith('\no-repo')
}

/**
 * Resolve the Workspace browser group that owns one Session.
 * @param workspaces - authoritative Workspace membership.
 * @param sessionId - Session whose browser group is required.
 * @returns owning Workspace id, or {@link UNGROUPED_KEY} when no Workspace accounts for it.
 */
export function owningGroupKey(
  workspaces: readonly WorkspaceView[],
  sessionId: SessionId,
): string {
  return (workspaces.find(workspace => workspace.sessionIds.includes(sessionId))
    ?.workspaceId as string | undefined) ?? UNGROUPED_KEY
}

/** Pending interaction kinds with dedicated Workspace-row presentation. */
export type SessionPendingInteractionStatus = 'approval' | 'plan-review' | 'question'
type SessionPendingInteractions = ReadonlyMap<SessionId, SessionPendingInteractionBase>

/** One top-level session row in a group or the flat list. */
export interface SessionNode {
  id: SessionId
  /** Stored display title; the renderer substitutes the localized New Session label for blank rows. */
  title: string
  /** The provisional blank session (renderer shows the localized New Session title). */
  blank: boolean
  /** Workspace directory of this session, when the Host projected one. */
  cwd?: string
  /** A Session-scoped UI consumer is awaiting this user. */
  pendingInteraction?: SessionPendingInteractionStatus
  running: boolean
  /** Latest durable turn was crash/reload-interrupted and no later turn started. */
  interrupted: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  /** Browser-local pin: the row also appears under the Pinned heading. */
  pinned?: boolean
  /** The current list projection contains at least one active Schedule record. */
  hasActiveSchedule: boolean
  updatedAt: number
}

/** Session order selected by the Workspace browser. */
export type SessionOrderBy = 'manual' | 'updated'

/** One workspace group section: header row facts + visible top-level session rows. */
export interface GroupNode {
  /** Group key: the workspace id or {@link UNGROUPED_KEY}. */
  key: string
  /** Backing Workspace id; absent only for the ungrouped bucket. */
  workspaceId: WorkspaceId | undefined
  cwd: string | undefined
  /** Additional workspace folders; empty for the Chat bucket. */
  folders: readonly string[]
  /** Workspace creation time (epoch ms); absent only for the Chat bucket without No Repo. */
  createdAt: number | undefined
  label: string
  /** Total visible sessions in the group. */
  sessionCount: number
  expanded: boolean
  /** The group contains the selected session (active folder tint; supplied here so the renderer never scans). */
  containsCurrent: boolean
  /** Visible session rows (empty while the group is folded). */
  sessions: readonly SessionNode[]
}

/** One flat search row combining list metadata with an optional content match. */
export interface SearchResultNode {
  id: SessionId
  title: string
  workspace: string
  /** A Session-scoped UI consumer is awaiting this user. */
  pendingInteraction?: SessionPendingInteractionStatus
  running: boolean
  interrupted: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  /** The current list projection contains at least one active Schedule record. */
  hasActiveSchedule: boolean
  snippet?: string
}

/** Bounded merged search projection plus the refine-query hint bit. */
export interface SearchResultSet {
  items: readonly SearchResultNode[]
  hasMore: boolean
}

/** Viewing state consumed by the derivation. */
export interface TreeView {
  expandedGroups: readonly string[]
  /** Browser-local order for Sessions without a backing Workspace account. */
  ungroupedOrder?: readonly string[]
}

interface Group {
  key: string
  workspaceId: WorkspaceId | undefined
  cwd: string | undefined
  folders: readonly string[]
  createdAt: number | undefined
  label: string
  sessions: SessionSummary[]
}

/**
 * Directory display label: basename of the path (both separators accepted).
 * Ungrouped-bucket fallback for surfaces without a workspace title.
 * @param cwd - directory path, or undefined for the ungrouped bucket.
 * @returns basename, the raw cwd when it has no basename, or an empty ungrouped marker.
 */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return UNGROUPED_LABEL
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/** Recency comparator: newest first, id as the deterministic tiebreak (ids are unique per group). */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : 1
}

/**
 * Ordinary sessions are visible; among blank sessions, only the current one
 * is visible. Subagent children use their parent header catalog; archived
 * sessions are visible nowhere, while their accounting slots remain so
 * unarchiving restores position.
 */
function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean {
  return session.origin !== 'subagent'
    && !archived.has(session.id)
    && (!session.blank || session.id === current)
}

/**
 * A blank session is the selected Workspace's provisional New Session row;
 * its canonical title never enters search (blank rows are query-excluded)
 * and the renderer localizes its display label.
 */
function sessionTitle(session: SessionSummary): string {
  return session.blank ? '' : session.displayTitle
}

/** The list projection alone owns the best-effort active-Schedule indicator. */
function hasActiveSchedule(session: SessionSummary): boolean {
  return (session.projectionValues?.schedule?.length ?? 0) > 0
}

/** Build one group without projecting session lineage into presentation. */
function buildGroup(
  key: string,
  workspaceId: WorkspaceId | undefined,
  cwd: string | undefined,
  folders: readonly string[],
  createdAt: number | undefined,
  label: string,
  members: readonly SessionSummary[],
  order: 'account' | 'recency',
): Group {
  const sessions = [...members]
  // Real Workspace order comes from sessionIds. Chat falls back to
  // recency until the browser supplies its persisted local order.
  if (order === 'recency') sessions.sort(byRecency)
  return { key, workspaceId, cwd, folders, createdAt, label, sessions }
}

/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
function orderedUngrouped(members: readonly SessionSummary[], stored: readonly string[]): SessionSummary[] {
  const byId = new Map(members.map(session => [session.id as string, session]))
  const included = new Set<string>()
  const ordered: SessionSummary[] = []
  for (const key of stored) {
    const session = byId.get(key)
    if (session === undefined || included.has(key)) continue
    ordered.push(session)
    included.add(key)
  }
  for (const session of [...members].sort(byRecency)) {
    if (included.has(session.id)) continue
    ordered.push(session)
  }
  return ordered
}

/**
 * Group Sessions by Host Workspace: one group per entity in stable Host
 * order, with members resolved from sessionIds in their stored order. Sessions
 * outside every Workspace trail in the browser-local Ungrouped order, which
 * falls back to recency before that order is initialized.
 */
function groupByWorkspace(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archived: ReadonlySet<SessionId>,
  ungroupedOrder: readonly string[] | undefined,
): Group[] {
  const groups: Group[] = []
  const accounted = new Set<SessionId>()
  let chatWorkspace: WorkspaceView | undefined
  const chatMembers: SessionSummary[] = []
  for (const workspace of workspaces) {
    const members: SessionSummary[] = []
    for (const id of workspace.sessionIds) {
      const summary = list.byId[id]
      if (summary === undefined) continue // account may lead the list pull; the row appears when the summary lands
      accounted.add(id)
      if (!sessionVisible(summary, list.current, archived)) continue
      members.push(summary)
    }
    if (isNoRepoWorkspace(workspace)) {
      chatWorkspace = workspace
      chatMembers.push(...members)
      continue
    }
    groups.push(buildGroup(
      workspace.workspaceId, workspace.workspaceId, workspace.path, workspace.folders ?? [],
      Date.parse(workspace.createdAt), workspace.title, members, 'account',
    ))
  }
  const stray = list.ids
    .map(id => list.byId[id])
    .filter((s): s is SessionSummary =>
      s !== undefined && !accounted.has(s.id) && sessionVisible(s, list.current, archived))
  const chatSessions = [...chatMembers, ...stray]
  groups.push(buildGroup(
    UNGROUPED_KEY,
    chatWorkspace?.workspaceId,
    chatWorkspace?.path,
    chatWorkspace?.folders ?? [],
    chatWorkspace === undefined ? undefined : Date.parse(chatWorkspace.createdAt),
    UNGROUPED_LABEL,
    ungroupedOrder === undefined ? chatSessions : orderedUngrouped(chatSessions, ungroupedOrder),
    ungroupedOrder === undefined ? 'recency' : 'account',
  ))
  return groups
}

/** Keep navigation presentation independent from domain-owned interaction objects. */
function visiblePendingKind(kind: string | undefined): SessionPendingInteractionStatus | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

function sessionNode(
  s: SessionSummary,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  pendingInteractions: SessionPendingInteractions,
): SessionNode {
  const pendingInteraction = visiblePendingKind(pendingInteractions.get(s.id)?.kind)
  return {
    id: s.id,
    title: sessionTitle(s),
    blank: s.blank,
    ...(s.cwd === undefined ? {} : { cwd: s.cwd }),
    running: s.running,
    interrupted: s.interrupted === true,
    runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
    completed: s.completed === true,
    hasActiveSchedule: hasActiveSchedule(s),
    updatedAt: s.updatedAt,
    ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
  }
}

/**
 * Derive the workspace browser groups with every session as a top-level row.
 *
 * Project groups appear in Host order, then Chat. Sessions populate under
 * expanded groups in the selected local order. Blank sessions are excluded
 * except for the selected provisional New Session row; archived sessions
 * are excluded everywhere. Auto-hide (`emptyWorkspaces === 'hide'`) omits a
 * project group whose visible `sessionCount` is 0 unless that group owns
 * `list.current` (including a blank current Session). Chat / No Repo always
 * remains. Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot (`current` feeds containsCurrent).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingInteractions - pending UI interactions by Session.
 * @param view - local expansion arrays.
 * @param hiddenWorkspaceIds - registry-global hidden Workspace set. Hidden
 * project Workspaces stay out of the main grouped list; callers that need
 * Hidden-section rows pass those ids into {@link deriveHiddenGroups}.
 * Auto-hide never writes this set.
 * @param emptyWorkspaces - `'hide'` omits empty project groups from this
 * list. Any other value is Always show. Chat / No Repo always remains, and
 * the Workspace that owns `list.current` remains even when empty.
 * @returns group sections in render order.
 */
export function deriveGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  view: TreeView,
  hiddenWorkspaceIds: readonly WorkspaceId[] = [],
  emptyWorkspaces: SessionEmptyWorkspaces = 'show',
): GroupNode[] {
  const archived = new Set(archivedSessionIds)
  const hidden = new Set(hiddenWorkspaceIds)
  const expandedGroups = new Set(view.expandedGroups)
  const descendants = indexSubagentDescendants(list.byId)
  const owner = list.current === undefined
    ? undefined
    : workspaces.find(w => w.sessionIds.includes(list.current as SessionId))
  const currentGroup = list.current === undefined
    ? undefined
    : (owner !== undefined && !isNoRepoWorkspace(owner) ? owner.workspaceId as string : UNGROUPED_KEY)
  const groups: GroupNode[] = []
  for (const g of groupByWorkspace(list, workspaces, archived, view.ungroupedOrder)) {
    if (g.key !== UNGROUPED_KEY && g.workspaceId !== undefined && hidden.has(g.workspaceId)) continue
    if (
      emptyWorkspaces === 'hide'
      && g.key !== UNGROUPED_KEY
      && g.sessions.length === 0
      && g.key !== currentGroup
    ) continue
    const expanded = expandedGroups.has(g.key)
    groups.push({
      key: g.key,
      workspaceId: g.workspaceId,
      cwd: g.cwd,
      folders: g.folders,
      createdAt: g.createdAt,
      label: g.label,
      sessionCount: g.sessions.length,
      expanded,
      containsCurrent: g.key === currentGroup,
      sessions: expanded
        ? g.sessions.map(session => sessionNode(session, descendants, pendingInteractions))
        : [],
    })
  }
  return groups
}

/**
 * Hidden-section Workspace groups in durable Host order.
 * @param list - sessions list snapshot.
 * @param workspaces - real workspaces in stable Host order (including hidden).
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingInteractions - pending UI interactions by Session.
 * @param view - local expansion arrays.
 * @param hiddenWorkspaceIds - registry-global hidden Workspace set.
 * @returns hidden Workspace groups in Host items order.
 */
export function deriveHiddenGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  view: TreeView,
  hiddenWorkspaceIds: readonly WorkspaceId[],
): GroupNode[] {
  if (hiddenWorkspaceIds.length === 0) return []
  const hidden = new Set(hiddenWorkspaceIds)
  const archived = new Set(archivedSessionIds)
  const expandedGroups = new Set(view.expandedGroups)
  const descendants = indexSubagentDescendants(list.byId)
  const currentGroup = list.current === undefined
    ? undefined
    : (workspaces.find(w => w.sessionIds.includes(list.current as SessionId))?.workspaceId as string | undefined)
  const groups: GroupNode[] = []
  for (const g of groupByWorkspace(list, workspaces, archived, undefined)) {
    if (g.key === UNGROUPED_KEY || g.workspaceId === undefined || !hidden.has(g.workspaceId)) continue
    const expanded = expandedGroups.has(g.key)
    groups.push({
      key: g.key,
      workspaceId: g.workspaceId,
      cwd: g.cwd,
      folders: g.folders,
      createdAt: g.createdAt,
      label: g.label,
      sessionCount: g.sessions.length,
      expanded,
      containsCurrent: g.key === currentGroup,
      sessions: expanded
        ? g.sessions.map(session => sessionNode(session, descendants, pendingInteractions))
        : [],
    })
  }
  return groups
}

/** Sidebar activity bucket used to float live work or paint status folders. */
export type SessionActivityBucket = 'pinned' | 'unread' | 'running' | 'abnormal' | 'history'

/** Drag and overflow cluster: live work stays above idle rows. */
export type SessionListCluster = 'live' | 'idle'

/** Status sections that show a count badge when folders are on. */
export const BADGED_ACTIVITY_BUCKETS = ['unread', 'running', 'abnormal'] as const satisfies readonly SessionActivityBucket[]

/**
 * Classify one visible Session into Completed / Running / Abnormal / History.
 * Live work outranks an unviewed completion; a crash/reload interruption is
 * Abnormal unless the Session is running again.
 * @param node - derived session row.
 * @returns the status bucket for this row.
 */
export function sessionActivityBucket(
  node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'interrupted' | 'runningSubagentCount' | 'completed'>,
): SessionActivityBucket {
  if (node.pendingInteraction !== undefined || node.running || node.runningSubagentCount > 0) {
    return 'running'
  }
  if (node.interrupted) return 'abnormal'
  if (node.completed) return 'unread'
  return 'history'
}

/**
 * Split live work from idle rows while preserving each side's incoming order.
 * Pending interaction, own running, and running descendants are live; every
 * other row is idle.
 * @param sessions - visible rows in the current view order.
 * @returns live rows first, then idle rows.
 */
export function partitionLiveIdle(sessions: readonly SessionNode[]): {
  live: readonly SessionNode[]
  idle: readonly SessionNode[]
} {
  const live: SessionNode[] = []
  const idle: SessionNode[] = []
  for (const session of sessions) {
    if (sessionActivityBucket(session) === 'running') live.push(session)
    else idle.push(session)
  }
  return { live, idle }
}

/** One classified status section; tests keep empty buckets present. */
export interface SessionActivitySection {
  bucket: SessionActivityBucket
  sessions: readonly SessionNode[]
}

/**
 * Split a Session list into Completed / Running / Abnormal / History.
 * Empty sections stay present so the renderer can skip a heading with no rows.
 * The pinned bucket stays empty here: the browser paints pinned rows from the
 * store, not from this classification.
 * @param sessions - visible rows in the current view order.
 * @returns the five sections in classification order.
 */
export function partitionSessionActivity(sessions: readonly SessionNode[]): readonly SessionActivitySection[] {
  const unread: SessionNode[] = []
  const running: SessionNode[] = []
  const abnormal: SessionNode[] = []
  const history: SessionNode[] = []
  for (const session of sessions) {
    const bucket = sessionActivityBucket(session)
    if (bucket === 'unread') unread.push(session)
    else if (bucket === 'running') running.push(session)
    else if (bucket === 'abnormal') abnormal.push(session)
    else history.push(session)
  }
  return [
    { bucket: 'pinned', sessions: [] },
    { bucket: 'unread', sessions: unread },
    { bucket: 'running', sessions: running },
    { bucket: 'abnormal', sessions: abnormal },
    { bucket: 'history', sessions: history },
  ]
}

/**
 * Derive the flat session list ("In one list" mode): every session — fork
 * children included — as a top-level row, strictly newest-first. No grouping,
 * no parent/child adjacency. Content search lives outside this derivation
 * (see {@link deriveSearchResults}).
 * @param list - sessions list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingInteractions - pending UI interactions by Session.
 * @param includeSessionIds - extra ids to consider even when they are not in
 * `list.ids` (Pinned rows whose Workspace is Host-hidden).
 * @returns flat rows in render order.
 */
export function deriveFlat(
  list: SessionListState,
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  includeSessionIds: readonly SessionId[] = [],
): SessionNode[] {
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)
  const rows: SessionSummary[] = []
  const seen = new Set<SessionId>()
  for (const id of [...list.ids, ...includeSessionIds]) {
    if (seen.has(id)) continue
    seen.add(id)
    const s = list.byId[id]
    if (s === undefined || !sessionVisible(s, list.current, archived)) continue
    rows.push(s)
  }
  rows.sort(byRecency)
  return rows.map(session => sessionNode(session, descendants, pendingInteractions))
}

/**
 * Merge immediate title/Workspace substring matches with ranked Host content
 * matches. Local rows lead newest-first, content-only rows retain backend
 * order, and duplicate sessions receive the backend snippet in place.
 * @param list - session metadata authority.
 * @param workspaces - Workspace membership and display labels.
 * @param query - caller text; surrounding whitespace is ignored.
 * @param archivedSessionIds - registry-global archive set (members never match).
 * @param pendingInteractions - pending UI interactions by Session.
 * @param content - ranked Host content-search page.
 * @param limit - protocol-owned maximum merged row count.
 * @returns bounded deduplicated flat rows and a refine-query hint bit.
 */
export function deriveSearchResults(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  query: string,
  archivedSessionIds: readonly SessionId[],
  pendingInteractions: SessionPendingInteractions,
  content: { items: readonly SessionSearchResultItem[]; hasMore: boolean },
  limit: number,
): SearchResultSet {
  const q = query.trim().toLowerCase()
  if (q === '') return { items: [], hasMore: false }
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)

  const workspaceBySession = new Map<SessionId, string>()
  for (const workspace of workspaces) {
    const title = isNoRepoWorkspace(workspace) ? UNGROUPED_LABEL : workspace.title
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, title)
    }
  }
  const labelOf = (summary: SessionSummary): string =>
    workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd)
  const contentBySession = new Map<SessionId, SessionSearchResultItem>()
  for (const item of content.items) {
    if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item)
  }

  const local: SessionSummary[] = []
  for (const id of list.ids) {
    const summary = list.byId[id]
    // Blank placeholders never match a query (their canonical title displays
    // localized, so matching it would tie search to one language).
    if (summary === undefined || summary.blank || !sessionVisible(summary, list.current, archived)) continue
    if (
      sessionTitle(summary).toLowerCase().includes(q)
      || labelOf(summary).toLowerCase().includes(q)
    ) {
      local.push(summary)
    }
  }
  local.sort(byRecency)

  const ordered: SessionSummary[] = []
  const included = new Set<SessionId>()
  const include = (summary: SessionSummary): void => {
    if (included.has(summary.id)) return
    included.add(summary.id)
    ordered.push(summary)
  }
  for (const summary of local) include(summary)
  for (const item of content.items) {
    const summary = list.byId[item.sessionId]
    if (summary !== undefined && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary)
  }

  return {
    items: ordered.slice(0, limit).map((summary) => {
      const match = contentBySession.get(summary.id)
      const pendingInteraction = visiblePendingKind(pendingInteractions.get(summary.id)?.kind)
      return {
        id: summary.id,
        title: sessionTitle(summary),
        workspace: labelOf(summary),
        running: summary.running,
        interrupted: summary.interrupted === true,
        runningSubagentCount: descendants.get(summary.id)?.runningCount ?? 0,
        ...(pendingInteraction === undefined
          ? {}
          : { pendingInteraction }),
        completed: summary.completed === true,
        hasActiveSchedule: hasActiveSchedule(summary),
        ...match === undefined ? {} : { snippet: match.snippet },
      }
    }),
    hasMore: content.hasMore || ordered.length > limit,
  }
}
