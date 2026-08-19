import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import AutomationService, {
  AutomationInputError,
  internals,
  MIN_EVERY_INTERVAL_SECONDS,
  nextLocalClockInstant,
  resolveAtInstant,
} from '../src/index.ts'


const WORKSPACE = WorkspaceId('ws-main')
const NOW = Date.parse('2026-08-15T12:00:00.000Z')

afterEach(() => {
  internals.now = () => Date.now()
  internals.uuid = () => crypto.randomUUID()
  vi.useRealTimers()
})

interface CreatedAgent {
  session: {
    id: SessionId
    append: ReturnType<typeof vi.fn>
  }
  followup: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  status: 'idle' | 'running'
  ctx: Context
}

async function harness(options: {
  permissionNames?: string[]
  presets?: Array<{ id: string; broken?: string }>
} = {}) {
  internals.now = () => NOW
  let seq = 0
  internals.uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

  const ctx = new Context()
  const pool = new MemoryMediaPool()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)

  const created: CreatedAgent[] = []
  const agents = new Map<SessionId, CreatedAgent>()
  ctx.provide('agents', {
    create: vi.fn(async ({ sessionId, meta }: { sessionId: SessionId; meta?: { origin?: string; cwd?: string } }) => {
      const agentCtx = new Context()
      const agent: CreatedAgent = {
        session: { id: sessionId, append: vi.fn() },
        followup: vi.fn(),
        cancel: vi.fn(),
        status: 'idle',
        ctx: agentCtx,
      }
      created.push(agent)
      agents.set(sessionId, agent)
      expect(meta?.origin).toBe('automation')
      expect(meta?.cwd).toBe('/work/project')
      return { agent }
    }),
    get: (id: SessionId) => agents.get(id),
  })
  ctx.provide('sessions', {
    get: (id: SessionId) => created.find(item => item.session.id === id)?.session,
    list: () => created.map(item => item.session),
    flush: async () => undefined,
  })
  ctx.provide('agentDefaultModel', {
    currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
  })
  ctx.provide('workspaceRegistry', {
    get: (id: WorkspaceId) => id === WORKSPACE
      ? { path: '/work/project', attachSession: vi.fn(async () => undefined) }
      : undefined,
  })
  if (options.presets !== undefined) {
    ctx.provide('agentPresets', {
      resolve: async (id?: string) => {
        const wanted = id ?? 'standard'
        const found = options.presets!.find(preset => preset.id === wanted)
        if (found === undefined) throw new Error(`unknown preset ${wanted}`)
        return found
      },
      mount: vi.fn(async () => undefined),
    })
  }
  if (options.permissionNames !== undefined) {
    ctx.provide('permissionPresets', {
      names: options.permissionNames,
      set: vi.fn(),
    })
  }

  const fiber = await ctx.plugin(AutomationService, { maxConcurrentRuns: 2, minEverySeconds: MIN_EVERY_INTERVAL_SECONDS })
  return { ctx, created, agents, fiber, service: ctx.automation }
}

describe('automation selectors', () => {
  it('resolves an offset-bearing at instant', () => {
    expect(resolveAtInstant('2026-08-15T13:00:00+00:00', NOW)).toBe('2026-08-15T13:00:00.000Z')
  })

  it('rejects a non-future at', () => {
    expect(() => resolveAtInstant('2026-08-15T11:00:00Z', NOW)).toThrow(AutomationInputError)
  })

  it('finds the next local-clock weekday after now', () => {
    const next = nextLocalClockInstant({
      time: '09:00',
      weekdays: [1],
      timeZone: 'UTC',
    }, NOW)
    expect(next).toBe('2026-08-17T09:00:00.000Z')
  })
})

describe('automation service', () => {
  it('creates an after rule and fires a new session when due', async () => {
    const { service, created } = await harness()
    const rule = await service.create({
      task: 'Write the daily report',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    expect(rule.name).toBe('Write the daily report')
    expect(rule.onOverlap).toBe('skip')
    expect(rule.scheduledAt).toBe('2026-08-15T12:01:00.000Z')
    expect(service.list()).toHaveLength(1)

    internals.now = () => Date.parse('2026-08-15T12:01:00.000Z')
    const run = await service.fireDue(rule.id, Date.parse('2026-08-15T12:01:00.000Z'))
    expect(run.outcome).toBe('started')
    expect(created).toHaveLength(1)
    expect(created[0]?.session.append).toHaveBeenCalledWith('automation/start', {
      ruleId: rule.id,
      runId: run.id,
      scheduledAt: '2026-08-15T12:01:00.000Z',
    })
    expect(created[0]?.followup).toHaveBeenCalledOnce()
    expect(service.get(rule.id)?.enabled).toBe(false)
  })

  it('rejects missing workspace and unknown selector combinations', async () => {
    const { service } = await harness()
    await expect(service.create({
      task: 'x',
      workspaceId: WorkspaceId('missing'),
      afterSeconds: 60,
    })).rejects.toMatchObject({ code: 'workspace_not_found' })
    await expect(service.create({
      task: 'x',
      workspaceId: WORKSPACE,
    })).rejects.toMatchObject({ code: 'invalid_selector' })
    await expect(service.create({
      task: '   ',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })).rejects.toMatchObject({ code: 'invalid_task' })
  })

  it('skips a busy previous session when onOverlap is skip', async () => {
    const { service, created, agents } = await harness()
    const rule = await service.create({
      task: 'repeat',
      workspaceId: WORKSPACE,
      everySeconds: 300,
      onOverlap: 'skip',
    })
    const first = await service.fireDue(rule.id, Date.parse('2026-08-15T12:05:00.000Z'))
    expect(first.outcome).toBe('started')
    const previous = created[0]
    if (previous === undefined) throw new Error('expected a created agent')
    previous.status = 'running'
    agents.set(previous.session.id, previous)

    const skipped = await service.fireDue(rule.id, Date.parse('2026-08-15T12:10:00.000Z'))
    expect(skipped.outcome).toBe('skipped_busy')
    expect(created).toHaveLength(1)
    expect(service.get(rule.id)?.scheduledAt).toBe('2026-08-15T12:15:00.000Z')
  })

  it('cancels a busy previous session when onOverlap is replace', async () => {
    const { service, created, agents } = await harness()
    const rule = await service.create({
      task: 'repeat',
      workspaceId: WORKSPACE,
      everySeconds: 300,
      onOverlap: 'replace',
    })
    const first = await service.fireDue(rule.id, Date.parse('2026-08-15T12:05:00.000Z'))
    const previous = created[0]
    if (previous === undefined) throw new Error('expected a created agent')
    previous.status = 'running'
    agents.set(previous.session.id, previous)

    const second = await service.fireDue(rule.id, Date.parse('2026-08-15T12:10:00.000Z'))
    expect(second.outcome).toBe('started')
    expect(previous.cancel).toHaveBeenCalledWith({ kind: 'automation', ruleId: rule.id }, { keepInbox: false })
    expect(service.listRuns(rule.id).some(run => run.id === first.id && run.outcome === 'replaced')).toBe(true)
    expect(created).toHaveLength(2)
  })

  it('does not treat an idle previous session as busy', async () => {
    const { service, created } = await harness()
    const rule = await service.create({
      task: 'once more',
      workspaceId: WORKSPACE,
      everySeconds: 300,
    })
    await service.fireDue(rule.id, Date.parse('2026-08-15T12:05:00.000Z'))
    expect(created[0]?.status).toBe('idle')
    const second = await service.fireDue(rule.id, Date.parse('2026-08-15T12:10:00.000Z'))
    expect(second.outcome).toBe('started')
    expect(created).toHaveLength(2)
  })

  it('pins a named permission preset on the new session', async () => {
    const { service, ctx } = await harness({ permissionNames: ['danger-full-access'] })
    const rule = await service.create({
      task: 'unattended',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
      permissionPreset: 'danger-full-access',
    })
    await service.fireDue(rule.id, Date.parse('2026-08-15T12:01:00.000Z'))
    expect(ctx.permissionPresets.set).toHaveBeenCalledOnce()
  })

  it('deletes a rule without recycling its id and keeps run history', async () => {
    const { service } = await harness()
    const rule = await service.create({
      task: 'temp',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    await service.fireDue(rule.id, Date.parse('2026-08-15T12:01:00.000Z'))
    expect(await service.delete(rule.id)).toBe(true)
    expect(service.get(rule.id)).toBeUndefined()
    expect(service.listRuns(rule.id)).toHaveLength(1)
    expect(await service.delete(rule.id)).toBe(false)
  })

  it('names a fired Session after the rule', async () => {
    const { ctx, service, created } = await harness()
    const rename = vi.fn()
    ctx.provide('sessionTitle', { rename })
    const rule = await service.create({
      name: 'FAC Sub2API daily deploy',
      task: 'read AGENTS.md and deploy',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    await service.runNow(rule.id)
    expect(rename).toHaveBeenCalledWith(created[0]!.session, 'FAC Sub2API daily deploy')
  })

  it('appends a title event when sessionTitle is absent', async () => {
    const { service, created } = await harness()
    const rule = await service.create({
      name: 'FAC Sub2API daily deploy',
      task: 'read AGENTS.md and deploy',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    await service.runNow(rule.id)
    expect(created[0]?.session.append).toHaveBeenCalledWith('session/title', {
      title: 'FAC Sub2API daily deploy',
      messageSeqs: [],
      source: { kind: 'user' },
    })
  })

  it('keeps firing when naming the Session fails', async () => {
    const { ctx, service } = await harness()
    ctx.provide('sessionTitle', {
      rename: () => { throw new Error('not live') },
    })
    const rule = await service.create({
      task: 'still fire',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    await expect(service.runNow(rule.id)).resolves.toMatchObject({ outcome: 'started' })
  })

  it('deleteRun removes one fire and keeps the rule', async () => {
    const { service } = await harness()
    const rule = await service.create({
      task: 'temp',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    const run = await service.runNow(rule.id)
    expect(run.source).toBe('manual')
    expect(await service.deleteRun(run.id)).toBe(true)
    expect(service.listRuns(rule.id)).toHaveLength(0)
    expect(service.get(rule.id)?.id).toBe(rule.id)
    expect(await service.deleteRun(run.id)).toBe(false)
  })

  it('records endedAt immediately when the Session is already idle', async () => {
    const { service, created } = await harness()
    const rule = await service.create({
      task: 'timed',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    const run = await service.runNow(rule.id)
    expect(run.endedAt).toBeUndefined()
    created[0]!.status = 'idle'
    service['runtime']?.watchEnded(created[0]! as never, (endedAt) => {
      void service.markRunEnded(created[0]!.session.id, endedAt)
    })
    await vi.waitFor(() => {
      expect(service.listRuns(rule.id)[0]?.endedAt).toBe('2026-08-15T12:00:00.000Z')
    })
  })

  it('records endedAt when the started Session leaves running', async () => {
    const { service, created } = await harness()
    const rule = await service.create({
      task: 'timed',
      workspaceId: WORKSPACE,
      afterSeconds: 60,
    })
    const run = await service.fireDue(rule.id, NOW)
    expect(run.source).toBe('schedule')
    expect(run.endedAt).toBeUndefined()
    created[0]!.status = 'running'
    created[0]!.ctx.emit('agent/status', { agent: created[0]! as unknown as Agent, status: 'idle' })
    await vi.waitFor(() => {
      expect(service.listRuns(rule.id)[0]?.endedAt).toBe('2026-08-15T12:00:00.000Z')
    })
  })

  it('runNow does not advance the next target', async () => {
    const { service } = await harness()
    const rule = await service.create({
      task: 'manual',
      workspaceId: WORKSPACE,
      everySeconds: 300,
    })
    const before = rule.scheduledAt
    await service.runNow(rule.id)
    expect(service.get(rule.id)?.scheduledAt).toBe(before)
  })
})

describe('automation timer', () => {
  it('fires an overdue after rule from the live owner', async () => {
    vi.useFakeTimers()
    internals.now = () => NOW
    const { service, created } = await harness()
    await service.create({
      task: 'timed',
      workspaceId: WORKSPACE,
      afterSeconds: 1,
    })
    internals.now = () => NOW + 1_000
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => { expect(created).toHaveLength(1) })
  })
})
