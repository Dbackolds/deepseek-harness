/**
 * Live-agent session.updateQueue paths: edit, remove, steer, and same-list
 * reorder of still-pending next-turn occurrences.
 */
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId('queue-' + String(nextRpc++)), payload }
}

async function harness(status: Agent['status'] = 'running') {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  const session = ctx.sessions.create()
  const steer = vi.fn()
  const agent = {
    id: session.id,
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status,
    ctx,
    steer,
  } as unknown as Agent
  ctx.agents.register(agent)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
    cwd: '/tmp',
  })
  return { ctx, session, agent, api, steer }
}

function queued(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

describe('session.updateQueue', () => {
  it('reorders a still-pending next-turn occurrence before an explicit sibling or the tail', async () => {
    const { ctx, agent, api } = await harness()
    const first = queued('first')
    const second = queued('second')
    const third = queued('third')
    agent.inbox.append('next-turn', first)
    agent.inbox.append('next-turn', second)
    agent.inbox.append('next-turn', third)

    const moved = await api.sessions.updateQueue(request({
      sessionId: agent.id,
      itemId: third.id,
      action: { kind: 'move', beforeItemId: first.id },
    }))
    expect(moved.result).toEqual({ ok: true, value: { accepted: true } })
    expect(agent.inbox.nextTurn.map(message => message.id)).toEqual([third.id, first.id, second.id])

    const tailed = await api.sessions.updateQueue(request({
      sessionId: agent.id,
      itemId: third.id,
      action: { kind: 'move' },
    }))
    expect(tailed.result).toEqual({ ok: true, value: { accepted: true } })
    expect(agent.inbox.nextTurn.map(message => message.id)).toEqual([first.id, second.id, third.id])

    const missingAnchor = await api.sessions.updateQueue(request({
      sessionId: agent.id,
      itemId: first.id,
      action: { kind: 'move', beforeItemId: queued('gone').id },
    }))
    expect(missingAnchor.result).toMatchObject({
      ok: false,
      error: { code: 'queue-item-not-found' },
    })
    expect(agent.inbox.nextTurn.map(message => message.id)).toEqual([first.id, second.id, third.id])
    await ctx.fiber.dispose()
  })

  it('refuses to reorder a next-step occurrence and leaves the lists unchanged', async () => {
    const { ctx, agent, api } = await harness()
    const queuedTurn = queued('queued')
    const steering = queued('steering')
    agent.inbox.append('next-turn', queuedTurn)
    agent.inbox.append('next-step', steering)

    const refused = await api.sessions.updateQueue(request({
      sessionId: agent.id,
      itemId: steering.id,
      action: { kind: 'move', beforeItemId: queuedTurn.id },
    }))
    expect(refused.result).toMatchObject({
      ok: false,
      error: { code: 'queue-item-not-found' },
    })
    expect(agent.inbox.nextTurn.map(message => message.id)).toEqual([queuedTurn.id])
    expect(agent.inbox.nextStep.map(message => message.id)).toEqual([steering.id])
    await ctx.fiber.dispose()
  })
})
