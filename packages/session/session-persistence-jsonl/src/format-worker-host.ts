/** One backend-owned catalog worker with cancellable admission and quiescent teardown. @module */
import { Worker } from 'node:worker_threads'
import { tmpdir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import { SessionFormatUnsupportedMigrationError } from '@deepseek-ai/dsh-session-format-catalog'
import type { JsonlCurrentGeneration, JsonlDecodedGeneration } from './generation.ts'
import type { FormatWorkerReply, FormatWorkerRequest } from './format-worker-protocol.ts'

/**
 * Wait without letting one cancelled reader cancel another reader's operation.
 * @param pending - independently owned work being awaited.
 * @param signal - cancellation of this wait only.
 * @returns the work result, or rejection with the exact cancellation reason.
 */
export async function waitForFormatWork<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let onAbort: (() => void) | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        // AbortSignal permits arbitrary reasons; the caller receives that exact value.
        // oxlint-disable-next-line prefer-promise-reject-errors
        onAbort = () => { reject(signal.reason) }
        signal.addEventListener('abort', onAbort, { once: true })
      }),
    ])
  } finally {
    if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
  }
}

function spawnFormatWorker(): Worker {
  /* v8 ignore next 3 -- the built-worker e2e exercises the emitted entry under plain Node. */
  if (!import.meta.url.endsWith('.ts')) {
    return new Worker(new URL('./format-worker.js', import.meta.url), { execArgv: [] })
  }
  const entry = new URL('./format-worker.ts', import.meta.url)
  const bootstrap = [
    `import { register } from ${JSON.stringify(import.meta.resolve('tsx/esm/api'))}`,
    'register()',
    `await import(${JSON.stringify(entry.href)})`,
  ].join('\n')
  const env: NodeJS.ProcessEnv = {}
  if (process.platform === 'win32') env.TMP = env.TEMP = tmpdir()
  if (process.env.TSX_TSCONFIG_PATH !== undefined) env.TSX_TSCONFIG_PATH = process.env.TSX_TSCONFIG_PATH
  return new Worker(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), { execArgv: [], env })
}

/** Serializes catalog computation across this backend's sessions in one lazy thread. */
export class JsonlFormatWorker {
  private worker: Worker | undefined
  private pending: Promise<undefined> | undefined
  private readonly stopped = new AbortController()
  /** Backend disposal cancels queued migration admission as well as catalog work. */
  readonly signal = this.stopped.signal

  constructor(ctx: Context, migrationSettled?: () => Promise<unknown> | undefined) {
    ctx.effect(() => async () => {
      this.stopped.abort(new Error('JSONL format worker disposed'))
      await migrationSettled?.()
      await this.close()
    })
  }

  /**
   * Release the thread after its owning migration finishes; admission must remain exclusive until close resolves.
   * @returns completion after every admitted computation and the worker exit.
   */
  async close(): Promise<void> {
    while (this.pending !== undefined) await this.pending
    await this.worker?.terminate()
    this.worker = undefined
  }

  /**
   * Compute or validate a generation; cancellation terminates only the active caller's thread.
   * @param operation - catalog operation to execute.
   * @param value - detached parsed JSONL values.
   * @param inputSignal - optional caller cancellation, independent of other queued readers.
   * @returns migrated values, or undefined after successful validation.
   */
  async run(
    operation: 'migrate' | 'validate',
    value: JsonlDecodedGeneration,
    inputSignal?: AbortSignal,
  ): Promise<JsonlCurrentGeneration | undefined> {
    const signal = inputSignal === undefined
      ? this.stopped.signal
      : AbortSignal.any([inputSignal, this.stopped.signal])
    signal.throwIfAborted()
    while (this.pending !== undefined) await waitForFormatWork(this.pending, signal)
    signal.throwIfAborted()
    const completion = Promise.withResolvers<undefined>()
    this.pending = completion.promise
    let worker: Worker | undefined
    let onMessage: ((reply: FormatWorkerReply) => void) | undefined
    let onError: ((error: Error) => void) | undefined
    let onExit: ((code: number) => void) | undefined
    const workerState = { failed: false }
    try {
      worker = this.worker
      if (worker === undefined) {
        worker = spawnFormatWorker()
        const owned = worker
        this.worker = worker
        // Idle failures have no caller; invalidate the thread so the next request can restart it.
        worker.on('error', () => { if (this.worker === owned) this.worker = undefined })
        worker.on('exit', () => { if (this.worker === owned) this.worker = undefined })
      }
      const activeWorker = worker
      const result = new Promise<JsonlCurrentGeneration | undefined>((resolve, reject) => {
        onMessage = (reply) => {
          if (reply.kind === 'result') resolve(reply.value)
          else if (reply.unsupported) {
            reject(new SessionFormatUnsupportedMigrationError(reply.error.message, { cause: reply.error }))
          } else reject(reply.error)
        }
        onError = (error) => { workerState.failed = true; reject(error) }
        onExit = (code) => {
          workerState.failed = true
          reject(new Error(`JSONL format worker exited before replying (code ${code})`))
        }
        activeWorker.once('message', onMessage)
        activeWorker.once('error', onError)
        activeWorker.once('exit', onExit)
        activeWorker.postMessage({ operation, value } satisfies FormatWorkerRequest)
      })
      return await waitForFormatWork(result, signal)
    } finally {
      // Cancellation stops synchronous catalog work before another request may use a thread.
      if ((signal.aborted || workerState.failed) && worker !== undefined) {
        await worker.terminate()
        if (this.worker === worker) this.worker = undefined
      }
      if (onMessage !== undefined) worker?.off('message', onMessage)
      if (onError !== undefined) worker?.off('error', onError)
      if (onExit !== undefined) worker?.off('exit', onExit)
      this.pending = undefined
      completion.resolve(undefined)
    }
  }
}
