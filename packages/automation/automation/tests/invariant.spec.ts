import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import * as AutomationInvariant from '../src/invariant.ts'
import { AutomationRuleId, AutomationRunId } from '../src/index.ts'
import type { AutomationRuleView, AutomationRunRecord } from '../src/types.ts'

async function setup(options: {
  rules?: string[]
  runs?: Array<{ id: string; ruleId: string }>
} = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(InvariantRegistry)
  ctx.provide('automation', {
    get: (id: AutomationRuleId) => (options.rules ?? []).includes(id)
      ? { id } as AutomationRuleView
      : undefined,
    listRuns: (ruleId: AutomationRuleId) => (options.runs ?? [])
      .filter(run => run.ruleId === ruleId)
      .map(run => ({ id: AutomationRunId(run.id), ruleId: AutomationRuleId(run.ruleId) }) as AutomationRunRecord),
  })
  await ctx.plugin(AutomationInvariant)
  return ctx
}

const putRule = (key = 'rule-1'): DomainChanged => ({
  domain: 'automation',
  table: 'rules',
  key,
  operation: 'put',
  value: {},
})

const deleteRule = (key = 'rule-1'): DomainChanged => ({
  domain: 'automation',
  table: 'rules',
  key,
  operation: 'deleted',
})

const putRun = (key = 'run-1', ruleId = 'rule-1'): DomainChanged => ({
  domain: 'automation',
  table: 'runs',
  key,
  operation: 'put',
  value: { ruleId },
})

describe('automation cache/table invariant', () => {
  it('accepts a put whose rule is still published', async () => {
    const ctx = await setup({ rules: ['rule-1'] })
    expect(() => { ctx.emit('domain/changed', putRule()) }).not.toThrow()
  })

  it('rejects a put the service cannot see', async () => {
    const ctx = await setup({ rules: [] })
    expect(() => { ctx.emit('domain/changed', putRule()) }).toThrow(/cannot see/)
  })

  it('rejects a delete while the service still publishes the rule', async () => {
    const ctx = await setup({ rules: ['rule-1'] })
    expect(() => { ctx.emit('domain/changed', deleteRule()) }).toThrow(/still publishes/)
  })

  it('accepts a run put visible through listRuns', async () => {
    const ctx = await setup({ runs: [{ id: 'run-1', ruleId: 'rule-1' }] })
    expect(() => { ctx.emit('domain/changed', putRun()) }).not.toThrow()
  })

  it('rejects deleting a run', async () => {
    const ctx = await setup()
    expect(() => {
      ctx.emit('domain/changed', { domain: 'automation', table: 'runs', key: 'run-1', operation: 'deleted' })
    }).toThrow(/append-only/)
  })
})
