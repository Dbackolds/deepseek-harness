/**
 * git domain contract: list and switch the per-session Git worktree overlay
 * without rewriting SessionHeader.cwd (workspace membership stays on the
 * workspace checkout).
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One local or remote-tracking branch a workspace repository advertises. */
export interface GitBranchView {
  /** Branch name without the refs/heads/ prefix. */
  name: string
  /** True when this name is the repository current HEAD. */
  current: boolean
  /** True when the name exists only as a remote-tracking branch. */
  remote: boolean
}

/** Snapshot a session branch picker needs. */
export interface SessionGitView {
  /** Branch this session operates on. */
  currentBranch: string
  /** Absolute directory this session operates in. */
  worktreePath: string
  /** True when the session uses an isolated worktree rather than the workspace checkout. */
  isolated: boolean
  /** Local and remote-tracking branches, workspace HEAD first. */
  branches: readonly GitBranchView[]
}

/** git-domain unary methods (the map keys git.* of RpcMethodMap). */
export interface GitApi {
  /**
   * Lists the workspace repository branches and this session overlay.
   * A path that is not a Git checkout answers `git-not-a-repository`.
   * Session-backed subagents reject with `agent-busy`.
   */
  describe(request: RpcRequest<{ sessionId: SessionId }>): Promise<RpcResponse<SessionGitView>>

  /**
   * Checks `branch` out for this session. The workspace current branch
   * reuses the workspace checkout; any other name gets an isolated worktree
   * under `$DSH_HOME/worktrees/<workspace-id>/<session-id>`. The switch is
   * one `git/worktree` event. Session-backed subagents reject with
   * `agent-busy`.
   */
  checkout(request: RpcRequest<{ sessionId: SessionId; branch: string }>): Promise<RpcResponse<SessionGitView>>

  /**
   * Creates a new local branch from the workspace HEAD and checks it out
   * for this session. An existing name answers `git-branch-exists`.
   * Session-backed subagents reject with `agent-busy`.
   */
  createBranch(request: RpcRequest<{ sessionId: SessionId; branch: string }>): Promise<RpcResponse<SessionGitView>>
}
