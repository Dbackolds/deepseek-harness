import { describe, expect, it } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { SubagentDeliveryPolicy } from '../src/client/delivery-policy.ts'
import type { SubagentDeliverySettings } from '../src/delivery-settings.ts'

describe('SubagentDeliveryPolicy', () => {
  it('defaults to Steer and writes an explicit change through the scope', () => {
    const host = stubSettingsScope<SubagentDeliverySettings>()
    const policy = new SubagentDeliveryPolicy(host.scope)
    expect(policy.settlementBusy.getSnapshot()).toBe('steer')
    expect(policy.reportBusy.getSnapshot()).toBe('steer')
    expect(policy.jobBusy.getSnapshot()).toBe('steer')
    expect(policy.writable.getSnapshot()).toBe(false)
    policy.set('reportBusy', 'queue')
    expect(policy.reportBusy.getSnapshot()).toBe('queue')
    expect(host.set).toHaveBeenCalledWith('reportBusy', 'queue')
    policy.set('reportBusy', 'queue')
    expect(host.set).toHaveBeenCalledOnce()
  })

  it('adopts a Host section without writing it back', () => {
    const host = stubSettingsScope<SubagentDeliverySettings>()
    const policy = new SubagentDeliveryPolicy(host.scope)
    host.publish({
      status: 'ready',
      writable: true,
      revision: 1,
      value: { settlementBusy: 'queue', reportBusy: 'steer', jobBusy: 'queue' },
    })
    expect(policy.writable.getSnapshot()).toBe(true)
    expect(policy.settlementBusy.getSnapshot()).toBe('queue')
    expect(policy.jobBusy.getSnapshot()).toBe('queue')
    expect(host.set).not.toHaveBeenCalled()
    host.publish({
      writable: true,
      value: { settlementBusy: 'queue', reportBusy: 'steer', jobBusy: 'queue' },
    })
    expect(policy.settlementBusy.getSnapshot()).toBe('queue')
    host.publish({
      value: { settlementBusy: 'queue', reportBusy: 'queue', jobBusy: 'queue' },
    })
    expect(policy.reportBusy.getSnapshot()).toBe('queue')
  })

  it('stays process-local without a Host scope and writes every field', () => {
    const policy = new SubagentDeliveryPolicy()
    policy.set('settlementBusy', 'queue')
    policy.set('jobBusy', 'queue')
    expect(policy.settlementBusy.getSnapshot()).toBe('queue')
    expect(policy.jobBusy.getSnapshot()).toBe('queue')
  })
})
