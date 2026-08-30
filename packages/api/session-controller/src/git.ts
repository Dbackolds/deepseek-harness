/** Session-addressed Git worktree overlay Remote. */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  checkoutSessionBranch, createSessionBranch, describeSessionGit, GitWorktreeError,
  sessionWorkingDirectory,
} from '@deepseek-ai/dsh-sandbox-policy'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Workspace, WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { WorkspaceId as brandWorkspaceId } from '@deepseek-ai/dsh-workspace'
import { ApiSessionAgentController } from './agent.ts'

import type {
  GitCheckoutRequest, GitDescribeRequest, SessionGitView,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionGit: SessionGitController
  }
}

function viewOf(state: Awaited<ReturnType<typeof describeSessionGit>>): SessionGitView {
  return {
    currentBranch: state.currentBranch,
    detached: state.detached,
    worktreePath: state.worktreePath,
    isolated: state.isolated,
    dirtyCount: state.dirtyCount,
    unpushedCount: state.unpushedCount,
    branches: state.branches,
  }
}

function gitFailure(error: unknown, workspacePath: string, branch?: string): never {
  if (error instanceof GitWorktreeError) {
    switch (error.code) {
      case 'not-a-repository':
        throw new RemoteError('session/git-not-a-repository', error.message, { path: workspacePath })
      case 'branch-invalid':
        throw new RemoteError('session/git-branch-invalid', error.message, { branch: branch ?? '' })
      case 'branch-exists':
        throw new RemoteError('session/git-branch-exists', error.message, { branch: branch ?? '' })
      default:
        throw new RemoteError('session/git-failed', error.message, { reason: error.message })
    }
  }
  throw new RemoteError('session/git-failed', error instanceof Error ? error.message : String(error), { reason: String(error) })
}

/** Host service backing `ctx.remote.git`. */
export class SessionGitController extends TypertRemoteService {
  static inject = ['agents', 'sessions', 'typert', 'workspaceRegistry']

  private readonly agents: ApiSessionAgentController

  constructor(ctx: Context) {
    super(ctx, 'sessionGit', { namespace: 'git' })
    this.agents = new ApiSessionAgentController(ctx)
  }

  @Remote('describe')
  async describe(request: GitDescribeRequest): Promise<SessionGitView> {
    if (request.sessionId !== undefined) {
      return this.sessionOp(request.sessionId, (session, workspace) =>
        describeSessionGit(workspace.path, session).then(viewOf))
    }
    if (request.workspaceId === undefined) {
      throw new RemoteError('gateway/bad-request', 'git.describe requires sessionId or workspaceId', {})
    }
    const workspace = this.ctx.workspaceRegistry.get(brandWorkspaceId(request.workspaceId))
    if (workspace === undefined) {
      throw new RemoteError('workspace/not-found', 'workspace "' + String(request.workspaceId) + '" not found', { workspaceId: request.workspaceId })
    }
    try {
      return viewOf(await describeSessionGit(workspace.path))
    } catch (error: unknown) {
      gitFailure(error, workspace.path)
    }
  }

  @Remote('checkout')
  checkout(request: GitCheckoutRequest): Promise<SessionGitView> {
    return this.sessionOp(request.sessionId, (session, workspace) =>
      checkoutSessionBranch(workspace.id, workspace.path, session, request.branch).then(viewOf), request.branch)
  }

  @Remote('createBranch')
  createBranch(request: GitCheckoutRequest): Promise<SessionGitView> {
    return this.sessionOp(request.sessionId, (session, workspace) =>
      createSessionBranch(workspace.id, workspace.path, session, request.branch).then(viewOf), request.branch)
  }

  private async sessionOp(
    sessionId: SessionId,
    run: (session: Session, workspace: Workspace) => Promise<SessionGitView>,
    branch?: string,
  ): Promise<SessionGitView> {
    const resolved = await this.agents.resolveAgent(sessionId)
    if ('error' in resolved) {
      throw new RemoteError(resolved.error.code, resolved.error.message, resolved.error.details)
    }
    const session = resolved.agent.session
    const cwd = sessionWorkingDirectory(session)
    if (cwd === undefined) {
      throw new RemoteError('gateway/internal', 'session "' + String(sessionId) + '" has no project cwd', {})
    }
    const workspace = this.ctx.workspaceRegistry.list().find(item => item.sessionIds.includes(session.id))
      ?? this.ctx.workspaceRegistry.list().find(item => item.path === cwd)
    if (workspace === undefined) {
      throw new RemoteError('workspace/not-found', 'session "' + String(sessionId) + '" is not accounted by a workspace', { workspaceId: '' as WorkspaceId })
    }
    try {
      return await run(session, workspace)
    } catch (error: unknown) {
      gitFailure(error, workspace.path, branch)
    }
  }
}

export default SessionGitController
