/** Session-addressed Git worktree overlay Remote. */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  checkoutSessionBranch, createSessionBranch, describeSessionGit, GitWorktreeError,
  sessionWorkingDirectory,
} from '@deepseek-ai/dsh-sandbox-policy'
import { Remote, TypertRemoteFailure, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
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
        throw new TypertRemoteFailure({
          code: 'git-not-a-repository',
          message: error.message,
          details: { path: workspacePath },
        })
      case 'branch-invalid':
        throw new TypertRemoteFailure({
          code: 'git-branch-invalid',
          message: error.message,
          details: { branch: branch ?? '' },
        })
      case 'branch-exists':
        throw new TypertRemoteFailure({
          code: 'git-branch-exists',
          message: error.message,
          details: { branch: branch ?? '' },
        })
      default:
        throw new TypertRemoteFailure({
          code: 'git-failed',
          message: error.message,
          details: { reason: error.message },
        })
    }
  }
  throw new TypertRemoteFailure({
    code: 'git-failed',
    message: error instanceof Error ? error.message : String(error),
    details: { reason: String(error) },
  })
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
      throw new TypertRemoteFailure({
        code: 'bad-request',
        message: 'git.describe requires sessionId or workspaceId',
        details: {},
      })
    }
    const workspace = this.ctx.workspaceRegistry.get(brandWorkspaceId(request.workspaceId))
    if (workspace === undefined) {
      throw new TypertRemoteFailure({
        code: 'workspace-not-found',
        message: 'workspace "' + String(request.workspaceId) + '" not found',
        details: { workspaceId: request.workspaceId },
      })
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
      throw new TypertRemoteFailure({
        code: resolved.error.code,
        message: resolved.error.message,
        details: resolved.error.details,
      })
    }
    const session = resolved.agent.session
    const cwd = sessionWorkingDirectory(session)
    if (cwd === undefined) {
      throw new TypertRemoteFailure({
        code: 'internal',
        message: 'session "' + String(sessionId) + '" has no project cwd',
        details: {},
      })
    }
    const workspace = this.ctx.workspaceRegistry.list().find(item => item.sessionIds.includes(session.id))
      ?? this.ctx.workspaceRegistry.list().find(item => item.path === cwd)
    if (workspace === undefined) {
      throw new TypertRemoteFailure({
        code: 'workspace-not-found',
        message: 'session "' + String(sessionId) + '" is not accounted by a workspace',
        details: { workspaceId: '' as WorkspaceId },
      })
    }
    try {
      return await run(session, workspace)
    } catch (error: unknown) {
      gitFailure(error, workspace.path, branch)
    }
  }
}

export default SessionGitController
