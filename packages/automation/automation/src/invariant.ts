/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-automation`.
 * @module @deepseek-ai/dsh-automation/invariant
 */
import { AutomationRuleId, AutomationRunId } from './index.ts'
const PACKAGE_NAME = '@deepseek-ai/dsh-automation'
/** Cordis companion plugin name. */
export const name = 'automation-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']
/**
 * Owned relationship: every durable rule or run row is reachable through
 * `ctx.automation`. A `domain/changed` put for `rules`/`runs` must name an id
 * `get`/`listRuns` can still observe; a delete is valid only after the service
 * no longer publishes that id. Foreign domains are ignored.
 */
const install = Object.assign((ctx, fail) => {
  ctx.on('domain/changed', (change) => {
    if (change.domain !== 'automation')
      return
    if (change.table === 'rules') {
      const id = AutomationRuleId(change.key)
      if (change.operation === 'deleted') {
        if (ctx.automation.get(id) !== undefined) {
          fail(`automation rule '${change.key}' was deleted while ctx.automation still publishes it`)
        }
        return
      }
      if (ctx.automation.get(id) === undefined) {
        fail(`automation rule '${change.key}' landed durably but ctx.automation.get cannot see it`)
      }
      return
    }
    if (change.table !== 'runs')
      return
    const runId = AutomationRunId(change.key)
    if (change.operation === 'deleted') {
      fail(`automation run '${change.key}' was deleted; runs are append-only history`)
      return
    }
    const ruleId = typeof change.value === 'object' && change.value !== null
            && 'ruleId' in change.value
            && typeof change.value.ruleId === 'string'
      ? AutomationRuleId(change.value.ruleId)
      : undefined
    if (ruleId === undefined) {
      fail(`automation run '${change.key}' landed without a ruleId`)
      return
    }
    if (!ctx.automation.listRuns(ruleId, Number.MAX_SAFE_INTEGER).some(run => run.id === runId)) {
      fail(`automation run '${change.key}' landed durably but listRuns cannot see it`)
    }
  })
}, { inject: ['automation'] })
/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = ctx => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
