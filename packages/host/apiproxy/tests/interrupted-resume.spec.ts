import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import {
  applyInterruptedListMetadata, createInterruptedResumeScheduler, foldListMetadataWithRepair,
} from '../src/interrupted-resume.ts'

const sid = (id: string): SessionId => id as SessionId

describe('interrupted list metadata', () => {
  it('marks an open crash/reload repair and clears it on the next turn start', () => {
    const start = { type: 'turn/start', seq: 0, time: 1, data: { turn: 1 } } as SessionEvent
    const end = {
      type: 'turn/end', seq: 1, time: 2,
      data: { turn: 1, reason: { kind: 'interrupted' } },
    } as SessionEvent
    const next = { type: 'turn/start', seq: 2, time: 3, data: { turn: 2 } } as SessionEvent
    expect(foldListMetadataWithRepair([start])).toMatchObject({ blank: false, interrupted: true })
    expect(applyInterruptedListMetadata({ blank: false, lastPromptAt: null }, end))
      .toMatchObject({ interrupted: true })
    expect(applyInterruptedListMetadata({ blank: false, lastPromptAt: null, interrupted: true }, next))
      .toEqual({ blank: false, lastPromptAt: null })
  })
})

describe('interrupted resume scheduler', () => {
  it('resumes an idle Agent once and sends a plugin notice followup', async () => {
    const ctx = new Context()
    ctx.provide('agents', {} as never)
    const followup = vi.fn()
    const agent = { status: 'idle', followup } as unknown as Agent
    const agentFor = vi.fn(async () => ({ agent }))
    const schedule = createInterruptedResumeScheduler(ctx, agentFor)
    schedule(sid('s1'))
    schedule(sid('s1'))
    await vi.waitFor(() => { expect(followup).toHaveBeenCalledOnce() })
    expect(agentFor).toHaveBeenCalledOnce()
    expect(followup.mock.calls[0]?.[0]).toMatchObject({
      role: 'user',
      source: { kind: 'plugin', plugin: 'dsh-host-apiproxy', form: 'notice' },
    })
  })

  it('skips when agents are absent, already running, or the lookup fails', async () => {
    const idle = new Context()
    const warn = vi.fn()
    idle.logger.warn = warn
    const noAgents = createInterruptedResumeScheduler(idle, vi.fn())
    noAgents(sid('missing'))
    expect(warn).not.toHaveBeenCalled()

    const ctx = new Context()
    ctx.provide('agents', {} as never)
    ctx.logger.warn = warn
    const followup = vi.fn()
    const running = { status: 'running', followup } as unknown as Agent
    const scheduleRunning = createInterruptedResumeScheduler(ctx, async () => ({ agent: running }))
    scheduleRunning(sid('live'))
    await vi.waitFor(() => { expect(followup).not.toHaveBeenCalled() })

    const failed = createInterruptedResumeScheduler(ctx, async () => ({ error: { message: 'gone' } }))
    failed(sid('gone'))
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('session.list: resume after interruption failed for "gone": gone')
    })

    const thrown = createInterruptedResumeScheduler(ctx, async () => { throw new Error('boom') })
    thrown(sid('boom'))
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith('session.list: resume after interruption failed for "boom": Error: boom')
    })
  })
})
