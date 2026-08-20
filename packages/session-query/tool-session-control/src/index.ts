/**
 * Model-facing search, stop, send, and library adapters over
 * `ctx.sessionControl` and `ctx.workspaceRegistry`.
 *
 * @module @deepseek-ai/dsh-tool-session-control
 */

import { realpath, stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { setSessionHome } from '@deepseek-ai/dsh-sandbox-policy'
import { SessionId } from '@deepseek-ai/dsh-session'
import { SessionControlError } from '@deepseek-ai/dsh-session-control'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { WorkspaceUnknownSessionError } from '@deepseek-ai/dsh-workspace'
import type { Workspace } from '@deepseek-ai/dsh-workspace'

/** Cordis plugin name. */
export const name = 'tool-session-control'
/** Capability services required by the model-facing consumer. */
export const inject = ['tools', 'sessionControl']

/**
 * Register the `session_control_*` tools.
 * Search, stop, and send always register. Library tools wait on
 * `workspaceRegistry`, which the Web composition mounts and CLI/TUI do not.
 * @param ctx - context carrying the tool registry and session-control service.
 */
export function apply(ctx: Context): void {
  registerDirectoryTools(ctx)
  ctx.inject(['workspaceRegistry'], (workspaceCtx) => {
    registerLibraryTools(workspaceCtx)
  })
}

/**
 * Register search, stop, and send. Always available.
 * @param ctx - context carrying the tool registry and session-control service.
 */
function registerDirectoryTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'session_control_search',
    description:
      'List every logical session with live driver status. Optional query matches session id, '
      + 'working directory, or title. Use this to find a conversation before stopping it, '
      + 'sending it a later message, or changing its archive or group. Results are newest-first '
      + 'and do not search message bodies.',
    parameters: {
      query: {
        type: 'string',
        description: 'Optional case-insensitive substring of session id, working directory, or title.',
      },
      limit: {
        type: 'integer',
        description: 'Optional positive result cap. Defaults to the service configuration.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value: string) => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      try {
        const rows = await ctx.sessionControl.search(
          {
            ...args.query === undefined ? {} : { query: args.query },
            ...args.limit === undefined ? {} : { limit: args.limit },
          },
          exec.signal,
        )
        if (rows.length === 0) return 'No matching sessions.'
        return rows.map(row => [
          row.sessionId,
          row.activity,
          row.title,
          row.cwd === undefined ? '' : ' cwd=' + row.cwd,
          row.parentSessionId === undefined ? '' : ' parent=' + row.parentSessionId,
          row.origin === undefined ? '' : ' origin=' + row.origin,
        ].join(' ')).join('\n')
      } catch (error: unknown) {
        throw formatToolError(error)
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_stop',
    description:
      'Stop the current turn of any logical session and keep queued inbox work. A known session '
      + 'with no live driver is an accepted no-op. This does not resume a cold session.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The session id from session_control_search or another listing.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          accepted: { type: 'boolean', required: true },
          attached: { type: 'boolean', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: value.attached
          ? 'stop requested for session ' + args.session_id
          : 'session ' + args.session_id + ' has no live driver; stop accepted as a no-op',
      }],
    },
    async execute(args, exec) {
      try {
        return await ctx.sessionControl.stop(SessionId(args.session_id), exec.signal)
      } catch (error: unknown) {
        throw formatToolError(error)
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_send',
    description:
      'Send a later user-role message to any live session. queue (default) becomes the next turn; '
      + 'steer reaches the nearest step. A storage-only session is not resumed; the call fails '
      + 'instead of taking ownership of that Agent.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The session id from session_control_search or another listing.',
      },
      message: {
        type: 'string',
        required: true,
        description: 'Self-contained text to deliver as one user-role message.',
      },
      mode: {
        type: 'string',
        enum: ['queue', 'steer'],
        description: 'Inbox placement. queue is the next turn; steer is the nearest step.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          messageId: { type: 'string', required: true },
        },
      },
      render: (args, _value) => [{
        type: 'text',
        text: 'message queued for session ' + args.session_id,
      }],
    },
    async execute(args, exec) {
      try {
        return await ctx.sessionControl.send({
          sessionId: SessionId(args.session_id),
          message: args.message,
          ...args.mode === undefined ? {} : { mode: args.mode },
        }, exec.signal)
      } catch (error: unknown) {
        throw formatToolError(error)
      }
    },
  }))

}

/**
 * Register archive, unarchive, rehome, reorder, and workspace listing.
 * @param ctx - child context with `workspaceRegistry` injected.
 */
function registerLibraryTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'session_control_workspaces',
    description:
      'List registered workspaces for conversation grouping: id, title, path, hidden flag, and '
      + 'accounted session ids with archived conversations omitted. Use this before rehoming or '
      + 'reordering a conversation.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          workspaces: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                workspaceId: { type: 'string', required: true },
                title: { type: 'string', required: true },
                path: { type: 'string', required: true },
                hidden: { type: 'boolean', required: true },
                sessionIds: {
                  type: 'array',
                  required: true,
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.workspaces.length === 0
          ? 'No registered workspaces.'
          : value.workspaces.map(workspace => [
            workspace.workspaceId,
            workspace.hidden ? 'hidden' : 'visible',
            workspace.title,
            workspace.path,
            workspace.sessionIds.length === 0 ? '' : ' sessions=' + workspace.sessionIds.join(','),
          ].join(' ')).join('\n'),
      }],
    },
    isConcurrencySafe: () => true,
    async execute() {
      const archived = new Set(ctx.workspaceRegistry.archivedSessionIds)
      const hidden = new Set(ctx.workspaceRegistry.hiddenWorkspaceIds)
      return {
        workspaces: ctx.workspaceRegistry.list().map(workspace => ({
          workspaceId: String(workspace.id),
          title: workspace.title,
          path: workspace.path,
          hidden: hidden.has(workspace.id),
          sessionIds: workspace.sessionIds.filter(id => !archived.has(id)).map(String),
        })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_archive',
    description:
      'Archive one conversation so it leaves every grouping surface. The session log and its '
      + 'workspace accounting slot stay. An already archived id is a success no-op.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The session id from session_control_search or another listing.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', required: true },
          archived: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: 'archived session ' + value.sessionId,
      }],
    },
    async execute(args) {
      const sessionId = SessionId(args.session_id)
      try {
        await ctx.workspaceRegistry.archiveSession(sessionId)
      } catch (error: unknown) {
        throw formatToolError(error)
      }
      return { sessionId: args.session_id, archived: true }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_unarchive',
    description:
      'Restore one archived conversation to its prior grouping slot. A known id that is not '
      + 'archived is a success no-op. This does not open the conversation.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The session id from session_control_search or another listing.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', required: true },
          archived: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: 'unarchived session ' + value.sessionId,
      }],
    },
    async execute(args) {
      const sessionId = SessionId(args.session_id)
      try {
        await ctx.workspaceRegistry.unarchiveSession(sessionId)
      } catch (error: unknown) {
        throw formatToolError(error)
      }
      return { sessionId: args.session_id, archived: false }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_rehome',
    description:
      'Move one conversation\'s effective home and sidebar group to an existing directory. Do not '
      + 'mkdir. Canonical No Repo is refused. An unregistered existing directory is registered. '
      + 'Cross-group moves use this tool; same-group order uses session_control_reorder.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The session id from session_control_search or another listing.',
      },
      path: {
        type: 'string',
        required: true,
        description: 'Absolute existing directory that becomes this conversation\'s home.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', required: true },
          workspaceId: { type: 'string', required: true },
          path: { type: 'string', required: true },
          cwd: { type: 'string', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: 'moved session ' + args.session_id + ' to ' + value.path,
      }],
    },
    async execute(args) {
      const sessionId = SessionId(args.session_id)
      try {
        const value = await rehomeSession(ctx, sessionId, args.path)
        return { sessionId: args.session_id, ...value }
      } catch (error: unknown) {
        throw formatToolError(error)
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'session_control_reorder',
    description:
      'Move an accounted conversation inside its current workspace order. Omitted '
      + 'before_session_id appends. Does not change the working directory. Ungrouped '
      + 'conversations must be rehomed first.',
    parameters: {
      session_id: {
        type: 'string',
        required: true,
        description: 'The accounted session id to move.',
      },
      before_session_id: {
        type: 'string',
        description: 'Accounted neighbor to insert before. Omitted appends to the end of the group.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', required: true },
          workspaceId: { type: 'string', required: true },
          sessionIds: {
            type: 'array',
            required: true,
            items: { type: 'string' },
          },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: 'reordered session ' + args.session_id + ' in workspace ' + value.workspaceId,
      }],
    },
    async execute(args) {
      const sessionId = SessionId(args.session_id)
      const workspace = ownerOfSession(ctx, sessionId)
      if (workspace === undefined) {
        throw new Error(
          'session "' + args.session_id + '" is ungrouped; rehome it with session_control_rehome first',
        )
      }
      try {
        await workspace.insertSessionBefore(
          sessionId,
          args.before_session_id === undefined ? undefined : SessionId(args.before_session_id),
        )
      } catch (error: unknown) {
        throw formatToolError(error)
      }
      return {
        sessionId: args.session_id,
        workspaceId: String(workspace.id),
        sessionIds: workspace.sessionIds.map(String),
      }
    },
  }))
}

type HostRehome = (request: {
  rpcId: string
  payload: { sessionId: SessionId; path: string }
}) => Promise<{
  result:
    | { ok: true; value: { workspaceId: string; path: string; cwd: string } }
    | { ok: false; error: { message: string } }
}>

/**
 * Read Host `session.rehome` when the API proxy is present.
 * @param ctx - current plugin context.
 * @returns the Host RPC, or undefined when the composition has no Host rehome.
 */
function hostRehome(ctx: Context): HostRehome | undefined {
  const api = ctx.get('apiProxy') as { sessions?: { rehome?: HostRehome } } | undefined
  const rehome = api?.sessions?.rehome
  return typeof rehome === 'function' ? rehome : undefined
}

/**
 * Find the workspace that currently accounts a session.
 * @param ctx - library-tool context with `workspaceRegistry` injected.
 * @param sessionId - session to locate.
 * @returns the owning workspace, or undefined when the session is ungrouped.
 */
function ownerOfSession(ctx: Context, sessionId: SessionId): Workspace | undefined {
  return ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.includes(sessionId))
}

/**
 * Resolve an existing directory to its canonical path.
 * @param path - caller-supplied directory.
 * @returns the realpath of that directory.
 */
async function canonicalDirectory(path: string): Promise<string> {
  let canonical: string
  try {
    canonical = await realpath(path)
  } catch (error: unknown) {
    throw new Error(
      `path does not resolve to an existing directory: ${path}`,
      { cause: error },
    )
  }
  if (!(await stat(canonical)).isDirectory()) {
    throw new Error(`path is not a directory: ${path}`)
  }
  return canonical
}

/**
 * Canonical No Repo directory, or the unresolved home path when it is absent.
 * @returns the path that `session_control_rehome` refuses.
 */
async function noRepoCanonical(): Promise<string> {
  const noRepo = dshHomePath('no-repo')
  try {
    return await realpath(noRepo)
  } catch {
    return noRepo
  }
}

/**
 * Move one session onto an existing directory through Host or a live fallback.
 * @param ctx - library-tool context.
 * @param sessionId - session to move.
 * @param path - existing destination directory.
 * @returns the destination workspace id, path, and cwd.
 */
async function rehomeSession(
  ctx: Context,
  sessionId: SessionId,
  path: string,
): Promise<{ workspaceId: string; path: string; cwd: string }> {
  const canonical = await canonicalDirectory(path)
  if (canonical === await noRepoCanonical()) {
    throw new Error(`cannot rehome session "${sessionId}" back to No Repo`)
  }
  const host = hostRehome(ctx)
  if (host !== undefined) {
    const response = await host({
      rpcId: `session-control-rehome-${sessionId}`,
      payload: { sessionId, path: canonical },
    })
    if (!response.result.ok) throw new Error(response.result.error.message)
    return {
      workspaceId: String(response.result.value.workspaceId),
      path: response.result.value.path,
      cwd: response.result.value.cwd,
    }
  }
  const session = ctx.get('sessions')?.get(sessionId)
  if (session === undefined) {
    throw new Error(
      `session "${sessionId}" is not live; Host session.rehome is required to resume a cold conversation`,
    )
  }
  const target = await ctx.workspaceRegistry.create(canonical)
  setSessionHome(session, canonical)
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (workspace.id !== target.id && workspace.sessionIds.includes(sessionId)) {
      await workspace.detachSession(sessionId)
    }
  }
  await target.attachSession(sessionId)
  return { workspaceId: String(target.id), path: target.path, cwd: canonical }
}

/**
 * Unwrap known service errors so the tool result carries the public message.
 * @param error - thrown value from a service or helper.
 * @returns an Error the tool runtime can materialize.
 */
function formatToolError(error: unknown): Error {
  if (error instanceof SessionControlError || error instanceof WorkspaceUnknownSessionError) {
    return new Error(error.message)
  }
  return error instanceof Error ? error : new Error(String(error))
}
