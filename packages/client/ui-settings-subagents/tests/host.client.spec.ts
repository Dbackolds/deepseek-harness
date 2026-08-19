import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_SUBAGENT_BUSY_DELIVERY, SUBAGENT_DELIVERY_SETTINGS_NAMESPACE, apply,
} from '@deepseek-ai/dsh-client-ui-settings-subagents'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-settings-subagents host', () => {
  it('registers, validates, and disposes the durable delivery section', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = settingsNamespace(SUBAGENT_DELIVERY_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(ns)).toEqual({
      settlementBusy: DEFAULT_SUBAGENT_BUSY_DELIVERY,
      reportBusy: DEFAULT_SUBAGENT_BUSY_DELIVERY,
      jobBusy: DEFAULT_SUBAGENT_BUSY_DELIVERY,
    })
    await ctx.settings.update(ns, { reportBusy: 'queue' })
    expect(ctx.settings.get(ns)).toEqual({
      settlementBusy: 'steer',
      reportBusy: 'queue',
      jobBusy: 'steer',
    })
    await expect(ctx.settings.update(ns, { jobBusy: 'invalid' })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})
