/**
 * Model-facing search, stop, and send adapters over `ctx.sessionControl`.
 *
 * @module @deepseek-ai/dsh-tool-session-control
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { SessionControlError } from '@deepseek-ai/dsh-session-control'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'tool-session-control'
/** Capability services required by the model-facing consumer. */
export const inject = ['tools', 'sessionControl']

/**
 * Register the `session_control_search`, `session_control_stop`, and
 * `session_control_send` tools.
 * @param ctx - context carrying the tool registry and session-control service.
 */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'session_control_search',
    description:
      'List every logical session with live driver status. Optional query matches session id, '
      + 'working directory, or title. Use this to find a conversation before stopping it or '
      + 'sending it a later message. Results are newest-first and do not search message bodies.',
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
        throw formatControlError(error)
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
        throw formatControlError(error)
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
        throw formatControlError(error)
      }
    },
  }))
}

function formatControlError(error: unknown): Error {
  if (error instanceof SessionControlError) {
    return new Error(error.message)
  }
  return error instanceof Error ? error : new Error(String(error))
}
