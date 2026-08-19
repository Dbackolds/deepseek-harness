/**
 * workspace domain contract. Wire projection of the host-side workspace
 * entity (@deepseek-ai/dsh-workspace): a stable id over a directory path,
 * a display title, and the ordered session account. Method signatures are the
 * source of truth, same as the sessions domain.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Branded } from '@deepseek-ai/dsh-brand'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/**
 * Wire-side workspace id brand. Deliberately re-declared here rather than
 * imported from dsh-workspace: api/ must stay browser-importable with zero
 * host-package dependencies, and the brand string matches, so both sides
 * agree structurally.
 */
export type WorkspaceId = Branded<'WorkspaceId'>

/** One workspace row: the record projection every workspace.* value carries. */
export interface WorkspaceView {
  workspaceId: WorkspaceId
  /** Canonical primary directory path (host-side realpath canon). Session cwd stays bound to this path. */
  path: string
  /**
   * Additional canonical folders in durable add order. Never includes
   * {@link path}; uniqueness is canonical-path equality.
   */
  folders: string[]
  /** Display title (defaults to the path basename at create). */
  title: string
  /**
   * Sessions accounted under this workspace, in manually owned order
   * (attach prepends, insertSessionBefore reorders; activity never does).
   */
  sessionIds: SessionId[]
  /** ISO-8601 creation instant. */
  createdAt: string
  /** ISO-8601 last-mutation instant. */
  updatedAt: string
}

/** Workspace-domain unary methods (the map keys workspace.* of RpcMethodMap). */
export interface WorkspaceApi {
  /**
   * Lists all workspaces in the registry's durable display order, plus the
   * registry-global archive set (the reconnect baseline of
   * `host/archived-sessions-changed`) and the registry-global hidden set
   * (the reconnect baseline of `host/hidden-workspaces-changed`). Archived
   * sessions stay in their workspace's `sessionIds` account; grouping
   * surfaces hide them. Hidden workspaces stay in `items` and keep
   * membership; grouping surfaces fold them into Hidden.
   */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{
    items: WorkspaceView[]
    archivedSessionIds: SessionId[]
    hiddenWorkspaceIds: WorkspaceId[]
  }>>

  /**
   * Creates (or idempotently resolves) a workspace over an EXISTING directory
   * (no mkdir — a missing or non-directory path fails with
   * `workspace-invalid-path`). A path resolving to a directory already owned
   * by a workspace returns that workspace (`created: false`) and shows it
   * in place when it was hidden, without minting a new id or moving order.
   * Adoption allows distinct canonical paths whose basenames produce the
   * same display title; the registry's basename title default names the
   * new workspace.
   */
  create(request: RpcRequest<{ path: string }>):
  Promise<RpcResponse<{ workspace: WorkspaceView; created: boolean }>>

  /**
   * Renames a workspace. `title` is trimmed and must be non-empty
   * (schema-enforced). An unknown id fails with `workspace-not-found`; a
   * title equal to another workspace's fails with `workspace-name-conflict`.
   * Renaming to the current title is a no-op success (no durable write).
   */
  rename(request: RpcRequest<{ workspaceId: WorkspaceId; title: string }>):
  Promise<RpcResponse<{ workspace: WorkspaceView }>>

  /**
   * Removes one Workspace registration. The directory, every user file, and
   * every session log remain untouched; those Sessions consequently become
   * ungrouped. A hidden id is dropped from the hidden set in the same
   * operation. An unknown id fails with `workspace-not-found`.
   */
  delete(request: RpcRequest<{ workspaceId: WorkspaceId }>):
  Promise<RpcResponse<{ deleted: true }>>

  /**
   * Moves one Workspace within the registry display order,
   * DOM-insertBefore-like. An omitted anchor appends to the end.
   */
  insertBefore(request: RpcRequest<{
    workspaceId: WorkspaceId
    beforeWorkspaceId?: WorkspaceId
  }>): Promise<RpcResponse<{ workspaceIds: WorkspaceId[] }>>

  /**
   * Moves an accounted session within its workspace's manual order,
   * DOM-insertBefore-like: with `beforeSessionId` the session is inserted
   * before that anchor; omitted appends to the end. An unknown workspace
   * fails with `workspace-not-found`; a session or anchor not accounted by
   * the workspace fails with `workspace-move-invalid`. A move to the current
   * position is a no-op success.
   */
  insertSessionBefore(request: RpcRequest<{
    workspaceId: WorkspaceId
    sessionId: SessionId
    beforeSessionId?: SessionId
  }>): Promise<RpcResponse<{ workspace: WorkspaceView }>>

  /**
   * Adds an existing directory as an additional folder of a workspace.
   * The primary path or an already-accounted folder is a no-op success.
   * A missing or non-directory path fails with `workspace-invalid-path`;
   * a path already owned by another workspace fails with
   * `workspace-folder-conflict`. An unknown id fails with
   * `workspace-not-found`.
   */
  addFolder(request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>):
  Promise<RpcResponse<{ workspace: WorkspaceView }>>

  /**
   * Removes one additional folder from a workspace. The primary path
   * cannot be removed this way (`workspace-invalid-path`). An unaccounted
   * path is a no-op success. An unknown id fails with `workspace-not-found`.
   */
  removeFolder(request: RpcRequest<{ workspaceId: WorkspaceId; path: string }>):
  Promise<RpcResponse<{ workspace: WorkspaceView }>>

  /**
   * Adds one session to the registry-global archive set: the session
   * disappears from every grouping surface but keeps its session log and its
   * workspace accounting slot (a future unarchive restores its position).
   * Idempotent for an already archived id. A session neither live nor in
   * session persistence fails with `session-not-found`. Returns the full
   * updated set (same snapshot the changed frame carries).
   */
  archiveSession(request: RpcRequest<{ sessionId: SessionId }>):
  Promise<RpcResponse<{ archivedSessionIds: SessionId[] }>>

  /**
   * Adds one registered workspace to the registry-global hidden set: the
   * workspace leaves the main grouping list but keeps its registry-order
   * slot and its `sessionIds` account (Show restores that position).
   * Idempotent for an already hidden id. An unknown id fails with
   * `workspace-not-found`. Returns the full updated set (same snapshot the
   * changed frame carries).
   */
  hide(request: RpcRequest<{ workspaceId: WorkspaceId }>):
  Promise<RpcResponse<{ hiddenWorkspaceIds: WorkspaceId[] }>>

  /**
   * Removes one registered workspace from the registry-global hidden set.
   * A registered id that is not hidden is success without writing. An
   * unknown id fails with `workspace-not-found`. Returns the full updated
   * set (same snapshot the changed frame carries).
   */
  show(request: RpcRequest<{ workspaceId: WorkspaceId }>):
  Promise<RpcResponse<{ hiddenWorkspaceIds: WorkspaceId[] }>>
}
