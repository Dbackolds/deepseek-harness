/** git.* gateway: describe / checkout / createBranch against a real repo. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type AgentFactory } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import { RpcId, type RpcRequest } from '../src/api/rpc.ts'
import { createApiProxy } from '../src/api-proxy.ts'
import { describe, expect, it } from 'vitest'

let nextRpc = 0
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`git-${String(nextRpc++)}`), payload }
}

function stubAgent(session: Session): Agent {
  return { id: session.id, session, status: 'idle' } as unknown as Agent
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true })
}

async function harness() {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-apiproxy-git-')))
  git(cwd, ['init', '-b', 'main'])
  git(cwd, ['config', 'user.email', 'dev@example.com'])
  git(cwd, ['config', 'user.name', 'dev'])
  writeFileSync(join(cwd, 'README.md'), 'hello\n')
  git(cwd, ['add', '.'])
  git(cwd, ['commit', '-m', 'init'])
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  ctx.provide('sessionPersistence', { list: () => Promise.resolve([]) } as never)
  ctx.provide('workspaceRegistry', {
    list: () => [{
      id: 'ws-1',
      path: cwd,
      folders: [],
      sessionIds: ['git-s1'],
    }],
  } as never)
  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      const agentCtx = ctx.extend({ agent })
      ;(agent as { ctx?: Context }).ctx = agentCtx
      await options.setup?.(agentCtx)
      const unregister = ctx.agents.register(agent)
      return { agent, dispose: () => { unregister(); return Promise.resolve() } }
    },
    async resume() { throw new Error('unused') },
  }
  ctx.agents.setFactory(factory)
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'test', model: 'test-model' }),
    cwd,
  })
  await api.sessions.create(request({ sessionId: SessionId('git-s1'), cwd }))
  return { api, ctx, cwd }
}

describe('git.describe', () => {
  it('lists the workspace checkout when the session has no overlay', async () => {
    const { api } = await harness()
    const described = await api.git.describe(request({ sessionId: SessionId('git-s1') }))
    expect(described.result.ok).toBe(true)
    if (!described.result.ok) return
    expect(described.result.value.currentBranch).toBe('main')
    expect(described.result.value.isolated).toBe(false)
    expect(described.result.value.branches.some(branch => branch.name === 'main')).toBe(true)
  })
})

describe('git.checkout and git.createBranch', () => {
  it('isolates a new branch in a worktree for this session only', async () => {
    const { api, cwd } = await harness()
    const created = await api.git.createBranch(request({ sessionId: SessionId('git-s1'), branch: 'feature' }))
    expect(created.result.ok).toBe(true)
    if (!created.result.ok) return
    expect(created.result.value.currentBranch).toBe('feature')
    expect(created.result.value.isolated).toBe(true)
    expect(created.result.value.worktreePath).not.toBe(cwd)
    const back = await api.git.checkout(request({ sessionId: SessionId('git-s1'), branch: 'main' }))
    expect(back.result.ok).toBe(true)
    if (!back.result.ok) return
    expect(back.result.value.currentBranch).toBe('main')
    expect(back.result.value.isolated).toBe(false)
  })
})
