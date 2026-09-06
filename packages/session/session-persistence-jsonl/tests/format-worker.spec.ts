import { Context } from '@deepseek-ai/cordis'
import { SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { SessionFormatUnsupportedMigrationError } from '@deepseek-ai/dsh-session-format-catalog'
import type { Worker } from 'node:worker_threads'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { releasedV1OneTurnLog } from '../../session-persistence/tests/contract.ts'
import { JsonlFormatWorker } from '../src/format-worker-host.ts'
import type { JsonlDecodedGeneration } from '../src/generation.ts'

function historical(): JsonlDecodedGeneration {
  return {
    header: { type: 'session', version: 0, id: 'worker-history', createdAt: 1000, delegationDepth: 0 },
    rows: releasedV1OneTurnLog(),
  }
}

function activeThread(host: JsonlFormatWorker): Worker {
  // Retain the actual thread to verify exit, independently of host bookkeeping.
  const worker = (host as unknown as { worker: Worker | undefined }).worker
  expect(worker).toBeDefined()
  return worker!
}

describe('JSONL format worker', () => {
  let ctx: Context
  let host: JsonlFormatWorker

  beforeEach(() => {
    ctx = new Context()
    host = new JsonlFormatWorker(ctx)
  })

  afterEach(async () => { await ctx.fiber.dispose() })

  it('migrates released v0 chunks and validates the current physical generation', async () => {
    const result = await host.run('migrate', historical())
    expect(result).toBeDefined()
    expect(result!.header).toMatchObject({ version: SESSION_FORMAT_VERSION, id: 'worker-history' })
    expect(result!.rows).toHaveLength(6)
    expect(result!.rows).not.toContainEqual(expect.objectContaining({ type: 'assistant/chunk' }))
    await expect(host.run('validate', result!)).resolves.toBeUndefined()
  })

  it('lets a main-thread heartbeat run before migration completes', async () => {
    let settled = false
    const migration = host.run('migrate', historical()).finally(() => { settled = true })
    // Microtasks run before Worker message callbacks, giving this heartbeat a
    // deterministic position without comparing machine-dependent durations.
    await new Promise<void>((resolve) => { queueMicrotask(resolve) })
    expect(settled).toBe(false)
    expect(activeThread(host).threadId).toBeGreaterThan(0)
    await expect(migration).resolves.toBeDefined()
  })

  it('close waits for the admitted migration and thread exit before a later reopen', async () => {
    const migration = host.run('migrate', historical())
    const thread = activeThread(host)
    const closed = host.close()
    await expect(migration).resolves.toBeDefined()
    await closed
    expect(thread.threadId).toBe(-1)
    await expect(host.run('migrate', historical())).resolves.toBeDefined()
    expect(activeThread(host)).not.toBe(thread)
  })

  it('reconstructs unsupported migration errors and accepts a later valid request', async () => {
    const source = historical()
    const refused = { ...source, header: { ...source.header, version: SESSION_FORMAT_VERSION + 1 } }
    await expect(host.run('migrate', refused)).rejects.toBeInstanceOf(SessionFormatUnsupportedMigrationError)
    await expect(host.run('migrate', source)).resolves.toMatchObject({ header: { version: SESSION_FORMAT_VERSION } })
  })

  it('rejects an already aborted request without preventing a later migration', async () => {
    const controller = new AbortController()
    const reason = new Error('cancel before admission')
    controller.abort(reason)
    await expect(host.run('migrate', historical(), controller.signal)).rejects.toBe(reason)
    await expect(host.run('migrate', historical())).resolves.toBeDefined()
  })

  it('cancels a queued caller independently of the active migration', async () => {
    const active = host.run('migrate', historical())
    const controller = new AbortController()
    const queued = host.run('migrate', historical(), controller.signal)
    const reason = new Error('queued caller cancelled')
    // No Worker message callback can run before this synchronous abort.
    controller.abort(reason)
    await expect(queued).rejects.toBe(reason)
    await expect(active).resolves.toMatchObject({ header: { version: SESSION_FORMAT_VERSION } })
  })

  it('cancels the active migration and lets the next queued caller retry', async () => {
    const controller = new AbortController()
    const active = host.run('migrate', historical(), controller.signal)
    const thread = activeThread(host)
    const queued = host.run('migrate', historical())
    const reason = new Error('active caller cancelled')
    controller.abort(reason)
    await expect(active).rejects.toBe(reason)
    expect(thread.threadId).toBe(-1)
    await expect(queued).resolves.toMatchObject({ header: { version: SESSION_FORMAT_VERSION } })
  })

  it('disposal settles active and queued requests and refuses new work', async () => {
    const active = host.run('migrate', historical())
    const thread = activeThread(host)
    const queued = host.run('migrate', historical())
    // Attach rejection handlers before disposal can reject either operation.
    const settled = Promise.allSettled([active, queued])
    await ctx.fiber.dispose()
    expect(thread.threadId).toBe(-1)
    expect((await settled).map(result => result.status)).toEqual(['rejected', 'rejected'])
    await expect(host.run('migrate', historical())).rejects.toThrow()
  })

  it('disposal waits for the migration physical tail after the active worker exits', async () => {
    const entered = Promise.withResolvers<undefined>()
    const physicalTail = Promise.withResolvers<undefined>()
    host = new JsonlFormatWorker(ctx, () => {
      entered.resolve(undefined)
      return physicalTail.promise
    })
    const active = host.run('migrate', historical())
    const thread = activeThread(host)
    const rejected = expect(active).rejects.toThrow('disposed')
    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    try {
      await entered.promise
      expect(host.signal.aborted).toBe(true)
      await rejected
      expect(thread.threadId).toBe(-1)
      expect(disposed).toBe(false)
      await expect(host.run('migrate', historical())).rejects.toThrow('disposed')
    } finally {
      physicalTail.resolve(undefined)
      await disposal
    }
    expect(disposed).toBe(true)
  })

  it('retries in a new thread after the active worker exits without replying', async () => {
    const active = host.run('migrate', historical())
    const thread = activeThread(host)
    const rejected = expect(active).rejects.toThrow('exited before replying')
    await thread.terminate()
    await rejected
    expect(thread.threadId).toBe(-1)
    await expect(host.run('migrate', historical())).resolves.toBeDefined()
    expect(activeThread(host)).not.toBe(thread)
  })

  it('waits for thread exit after an error event before rejecting and retrying', async () => {
    const active = host.run('migrate', historical())
    const thread = activeThread(host)
    const reason = new Error('worker failed before native exit')
    const rejected = expect(active).rejects.toBe(reason)
    try {
      // Native error notification can precede exit; leave this real thread
      // running so only the host's error teardown can make it quiescent.
      thread.emit('error', reason)
      await rejected
      expect(thread.threadId).toBe(-1)
      await expect(host.run('migrate', historical())).resolves.toBeDefined()
      expect(activeThread(host)).not.toBe(thread)
    } finally {
      await thread.terminate()
    }
  })
})
