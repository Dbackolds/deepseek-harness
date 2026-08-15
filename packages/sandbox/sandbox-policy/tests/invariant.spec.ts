import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { type Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import InvariantRegistry, { InvariantError } from '@deepseek-ai/dsh-invariants'
import * as SandboxPolicyInvariant from '@deepseek-ai/dsh-sandbox-policy/invariant'

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(SandboxPolicyInvariant)
  return ctx
}

function modeEvent(mode: string): SessionEvent {
  return { type: 'sandbox/mode', seq: 0, time: 0, data: { mode } } as SessionEvent
}

describe('sandbox-policy invariants', () => {
  it.each(['read-only', 'workspace-write', 'danger-full-access'])(
    'accepts the durable %s mode',
    async (mode) => {
      const ctx = await setup()
      expect(() => { ctx.emit('session/event', {} as Session, modeEvent(mode)) }).not.toThrow()
    },
  )

  it('ignores unrelated event streams', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'turn/start', seq: 0, time: 0, data: {},
    } as SessionEvent) }).not.toThrow()
    expect(() => { ctx.emit('tools/change') }).not.toThrow()
  })

  it('rejects an empty git/worktree path', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'git/worktree', seq: 0, time: 0, data: { path: '', branch: 'main' },
    } as SessionEvent) }).toThrow(/git\/worktree carries empty path/)
  })

  it('rejects an empty git/worktree branch', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'git/worktree', seq: 0, time: 0, data: { path: '/wt', branch: '' },
    } as SessionEvent) }).toThrow(/git\/worktree carries empty branch/)
  })

  it('accepts a well-formed git/worktree overlay', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'git/worktree', seq: 0, time: 0, data: { path: '/wt', branch: 'main' },
    } as SessionEvent) }).not.toThrow()
  })

  it('rejects and attributes an unknown durable sandbox mode', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, modeEvent('host-root')) })
      .toThrow(new InvariantError('@deepseek-ai/dsh-sandbox-policy', 'sandbox/mode carries unknown mode "host-root"'))
  })

  it('rejects an unknown mode already present on late registration', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    ctx.sessions.create().append('sandbox/mode', { mode: 'host-root' as never })
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(SandboxPolicyInvariant).then(() => undefined)).rejects.toMatchObject({
      code: 'INVARIANT',
      packageName: '@deepseek-ai/dsh-sandbox-policy',
    })
  })
})
