import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  apply,
  HOST_LIFETIME_SETTINGS_NAMESPACE,
  hostLifetimeInternals,
  nextHostStartCount,
  type HostLifetimeSettings,
} from '../src/index.ts'

/** Mirrors the module-local namespace id in src/index.ts. */
const ONBOARDING_SETTINGS_NAMESPACE = 'ui-onboarding'
const HOST_NS = settingsNamespace(HOST_LIFETIME_SETTINGS_NAMESPACE)

class MemorySettings extends SettingsProvider {
  readonly writable = true
  private stored: Record<string, unknown> = {}
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({ ...this.stored }) }
  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.stored[ns] = section
    return Promise.resolve()
  }
}

afterEach(() => {
  hostLifetimeInternals.now = () => Date.now()
  hostLifetimeInternals.resetProcess()
})

describe('ui-settings-general host', () => {
  it('registers and disposes the durable onboarding namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    expect(ctx.settings.describe().map(row => row.ns)).toContain(
      ONBOARDING_SETTINGS_NAMESPACE,
    )
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(
      ONBOARDING_SETTINGS_NAMESPACE,
    )
  })

  it('records this process start once and increments the durable count', async () => {
    hostLifetimeInternals.now = () => Date.parse('2026-08-29T00:17:56.000Z')
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const first = ctx.plugin({ apply })
    await first.await()
    await expect.poll(() => {
      return ctx.settings.get(HOST_NS) as HostLifetimeSettings
    }).toMatchObject({
      startCount: 1,
      startedAt: '2026-08-29T00:17:56.000Z',
    })
    await first.dispose()
    const second = ctx.plugin({ apply })
    await second.await()
    await expect.poll(() => {
      return ctx.settings.get(HOST_NS) as HostLifetimeSettings
    }).toMatchObject({
      startCount: 1,
      startedAt: '2026-08-29T00:17:56.000Z',
    })
  })

  it('treats a missing stored count as the first start', () => {
    expect(nextHostStartCount(0)).toBe(1)
    expect(nextHostStartCount(-1)).toBe(1)
    expect(nextHostStartCount(8)).toBe(9)
  })
})
