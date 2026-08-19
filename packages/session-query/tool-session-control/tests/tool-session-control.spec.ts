import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import { CallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionQueryEngine from '@deepseek-ai/dsh-session-query'
import SessionControl from '@deepseek-ai/dsh-session-control'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as ToolSessionControl from '@deepseek-ai/dsh-tool-session-control'

class TestSessionQueryEngine extends SessionQueryEngine {
  override searchSessions(
    ..._args: Parameters<SessionQueryEngine['searchSessions']>
  ): ReturnType<SessionQueryEngine['searchSessions']> {
    return Promise.resolve({ items: [] })
  }

  override searchEvents(
    request: Parameters<SessionQueryEngine['searchEvents']>[0],
  ): ReturnType<SessionQueryEngine['searchEvents']> {
    return this.readSurface(request.sessionId).then(surface => ({
      session: surface.session,
      items: [],
    }))
  }
}

async function harness(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(TestSessionQueryEngine)
  await ctx.plugin(SessionControl)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(ToolSessionControl)
  return ctx
}

let calls = 0
function callTool(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({
    signal: new AbortController().signal,
    callId: CallId('call-' + String(++calls)),
    name,
    arguments: args,
  })
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

describe('dsh-tool-session-control', () => {
  it('registers the three session-control tools', async () => {
    const ctx = await harness()
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual([
      'session_control_search',
      'session_control_send',
      'session_control_stop',
    ])
    await ctx.fiber.dispose()
  })

  it('searches, stops, and sends through the session-control service', async () => {
    const ctx = await harness()
    const session = ctx.sessions.create(SessionId('live'))
    session.append('session/title', { title: 'Live work', messageSeqs: [], source: { kind: 'user' } })
    const agent = {
      id: session.id,
      session,
      status: 'idle',
      cancel: vi.fn(),
      followup: vi.fn(),
      steer: vi.fn(),
    } as unknown as Agent
    ctx.agents.register(agent)

    const listed = await callTool(ctx, 'session_control_search', { query: 'Live' })
    expect(listed.isError).toBe(false)
    expect(text(listed)).toContain('live idle Live work')

    const stopped = await callTool(ctx, 'session_control_stop', { session_id: 'live' })
    expect(stopped.isError).toBe(false)
    expect(text(stopped)).toBe('stop requested for session live')
    expect(agent.cancel).toHaveBeenCalled()

    const sent = await callTool(ctx, 'session_control_send', {
      session_id: 'live',
      message: 'hello',
      mode: 'queue',
    })
    expect(sent.isError).toBe(false)
    expect(text(sent)).toBe('message queued for session live')
    expect(agent.followup).toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it('surfaces a missing-session send as an errored tool result', async () => {
    const ctx = await harness()
    const result = await callTool(ctx, 'session_control_send', {
      session_id: 'missing',
      message: 'hello',
    })
    expect(result.isError).toBe(true)
    expect(text(result)).toContain('session "missing" was not found')
    await ctx.fiber.dispose()
  })
})
