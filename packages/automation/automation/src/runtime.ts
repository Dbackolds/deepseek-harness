/**
 * Process-local timer owner for enabled Automation rules.
 * @module @deepseek-ai/dsh-automation
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { AutomationRuleId } from './types.ts'
import type { StoredAutomationRule } from './spec.ts'
import { formatUtcInstant } from './time.ts'

/** Timer-facing subset of the Automation service. */
export interface AutomationTimerHost {
  dueRules(now: number): readonly StoredAutomationRule[]
  nextWakeAt(now: number): number | undefined
  fireDue(id: AutomationRuleId, now: number): Promise<unknown>
}

/** Largest delay that Node timers represent without clamping. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647
/**
 * Recheck wall-clock due rules at least this often while waiting.
 * Sleeping the Host stretches setTimeout against a monotonic clock, so a
 * long wait can miss a local-clock fire until the original delay elapses.
 */
export const MAX_WAIT_SLICE_MS = 60_000

/** One process-local projection of the durable Automation rule table. */
export class AutomationRuntime {
  private readonly stop = Promise.withResolvers<void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private run: Promise<void> | undefined
  private requested = false
  private stopping = false
  private readonly idleWatchers = new Map<AutomationRuleId, () => void>()

  constructor(
    private readonly ctx: Context,
    private readonly service: AutomationTimerHost,
    private readonly now: () => number,
  ) {}
  /** Begin the first timer derivation. */
  start() {
    this.requestDrive()
  }
  /** Recompute after a committed mutation, idle transition, or wall-clock wake. */
  requestDrive() {
    if (this.stopping)
      return
    this.clearTimer()
    this.requested = true
    if (this.run !== undefined)
      return
    this.run = this.drive().then(() => { this.retire() }, (error) => {
      this.ctx.logger.warn(`automation: runtime drive failed: ${renderThrown(error)}`)
      this.retire()
    })
  }
  /**
     * Cancel timers and in-flight drive.
     * @returns settlement after the current drive finishes or is abandoned.
     */
  async dispose() {
    this.stopping = true
    this.clearTimer()
    for (const stop of this.idleWatchers.values())
      stop()
    this.idleWatchers.clear()
    this.stop.resolve()
    if (this.run !== undefined)
      await this.run.catch(() => undefined)
  }
  retire() {
    this.run = undefined
    if (this.requested && !this.stopping)
      this.requestDrive()
  }
  clearTimer() {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
  }
  async drive() {
    this.requested = false
    while (!this.stopping && !this.requested) {
      const now = this.now()
      const due = this.service.dueRules(now)
      if (due.length === 0) {
        const target = this.service.nextWakeAt(now)
        if (target === undefined)
          return
        const delay = Math.min(Math.max(1, target - now), MAX_TIMER_DELAY_MS, MAX_WAIT_SLICE_MS)
        await this.wait(delay)
        continue
      }
      for (const rule of due) {
        if (this.stopping || this.requested)
          return
        await this.service.fireDue(rule.id, now)
      }
    }
  }
  wait(delay: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(() => {
        this.timer = undefined
        resolve()
      }, delay)
      void this.stop.promise.then(() => {
        this.clearTimer()
        resolve()
      }, () => undefined)
    })
  }
  /**
   * Record the instant a started Session leaves `running`.
   * @param agent - live agent opened by this fire.
   * @param onEnded - called once with a UTC instant.
   */
  watchEnded(agent: Agent, onEnded: (endedAt: string) => void) {
    if (agent.status === 'idle') {
      onEnded(formatUtcInstant(this.now()))
      return
    }
    let reported = false
    const report = (): void => {
      if (reported) return
      reported = true
      stop()
      stopDisposed()
      onEnded(formatUtcInstant(this.now()))
    }
    const stop = agent.ctx.on('agent/status', ({ status }) => {
      if (status === 'idle') report()
    })
    const stopDisposed = agent.ctx.on('agent/disposed', () => { report() })
  }

  /**
   * Retry a skipped one-shot when its previous session leaves `running`.
   * @param ruleId - Rule waiting on overlap.
   * @param agent - Previous started session's live agent.
   */
  watchIdle(ruleId: AutomationRuleId, agent: Agent) {
    this.idleWatchers.get(ruleId)?.()
    const stop = agent.ctx.on('agent/status', ({ status }) => {
      if (status !== 'idle')
        return
      stop()
      this.idleWatchers.delete(ruleId)
      this.requestDrive()
    })
    const stopDisposed = agent.ctx.on('agent/disposed', () => {
      stop()
      stopDisposed()
      this.idleWatchers.delete(ruleId)
      this.requestDrive()
    })
    this.idleWatchers.set(ruleId, () => {
      stop()
      stopDisposed()
    })
  }
}
/** Render an unknown value for process-local diagnostics only. */
function renderThrown(value) {
  return value instanceof Error ? value.message : String(value)
}
