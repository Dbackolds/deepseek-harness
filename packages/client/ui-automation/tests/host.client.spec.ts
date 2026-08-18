/** Host half: registers the keep-awake setting and releases it on dispose. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  AUTOMATION_SETTINGS_NAMESPACE, DEFAULT_KEEP_AWAKE, apply, keepAwakeInternals,
} from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-automation host', () => {
  it('registers, validates, and disposes the durable keepAwake preference', async () => {
    const spawn = vi.fn(() => {
      throw new Error('no helper in this test')
    })
    keepAwakeInternals.spawn = spawn as typeof keepAwakeInternals.spawn
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = settingsNamespace(AUTOMATION_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(ns)).toEqual({ keepAwake: DEFAULT_KEEP_AWAKE })
    await ctx.settings.update(ns, { keepAwake: true })
    expect(ctx.settings.get(ns)).toEqual({ keepAwake: true })
    expect(spawn).toHaveBeenCalled()
    ;(ctx.emit as (name: string, ns: unknown) => void)('settings/updated', settingsNamespace('locale'))
    await ctx.settings.update(ns, { keepAwake: false })
    expect(ctx.settings.get(ns)).toEqual({ keepAwake: false })
    await expect(ctx.settings.update(ns, { keepAwake: 'always' })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })

  it('leaves keep-awake off when settings is absent', () => {
    const ctx = new Context()
    apply(ctx)
  })
})
