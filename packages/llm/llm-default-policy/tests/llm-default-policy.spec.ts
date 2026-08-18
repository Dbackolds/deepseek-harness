/** Product-wide default policy layered over a real settings provider. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmDefaultPolicyConfig, {
  LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE,
  resolveProviderRetryPolicy,
  resolveStreamIdleTimeoutMs,
} from '../src/index.ts'
import { SettingsProvider, settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'

const NS = settingsNamespace(LLM_DEFAULT_POLICY_SETTINGS_NAMESPACE)

/** The smallest real provider: one in-memory document, always writable. */
class MemorySettings extends SettingsProvider {
  doc: Record<string, unknown> = {}

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

async function boot(config: Record<string, unknown> = {}): Promise<{
  ctx: Context
  settingsFiber: Context['fiber']
  policy: LlmDefaultPolicyConfig
}> {
  const ctx = new Context()
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber.await()
  await ctx.plugin(LlmDefaultPolicyConfig, config)
  return { ctx, settingsFiber, policy: ctx.llmDefaultPolicy }
}

describe('LlmDefaultPolicyConfig', () => {
  it('resolves product defaults without a settings write', async () => {
    const bench = await boot()
    expect(bench.policy.current()).toEqual({
      maxRetries: 5,
      unlimited: false,
      streamIdleTimeoutMs: 300_000,
    })
    await bench.ctx.fiber.dispose()
  })

  it('layers a user section over the composition entry', async () => {
    const bench = await boot()
    await bench.settingsFiber.ctx.settings.replace(NS, {
      maxRetries: 8,
      unlimited: true,
      streamIdleTimeoutMs: 60_000,
    })
    expect(bench.policy.current()).toEqual({
      maxRetries: 8,
      unlimited: true,
      streamIdleTimeoutMs: 60_000,
    })
    await bench.ctx.fiber.dispose()
  })

  it('falls back to the composition entry when the settings provider detaches', async () => {
    const bench = await boot({ maxRetries: 3 })
    await bench.settingsFiber.ctx.settings.replace(NS, {
      maxRetries: 9,
    })
    expect(bench.policy.current().maxRetries).toBe(9)
    await bench.settingsFiber.dispose()
    expect(bench.policy.current()).toEqual({
      maxRetries: 3,
      unlimited: false,
      streamIdleTimeoutMs: 300_000,
    })
    await bench.ctx.fiber.dispose()
  })

  it('keeps the composition entry when no settings provider is mounted', async () => {
    const ctx = new Context()
    await ctx.plugin(LlmDefaultPolicyConfig, { maxRetries: 4, streamIdleTimeoutMs: 10_000 })
    expect(ctx.llmDefaultPolicy.current()).toEqual({
      maxRetries: 4,
      unlimited: false,
      streamIdleTimeoutMs: 10_000,
    })
    await ctx.fiber.dispose()
  })

  it('rejects an invalid stored section at registration', async () => {
    const bench = await boot()
    await expect(bench.settingsFiber.ctx.settings.replace(NS, { maxRetries: -1 }))
      .rejects.toThrow(/maxRetries/)
    await bench.ctx.fiber.dispose()
  })
})

describe('resolve helpers', () => {
  const defaults = { maxRetries: 5, unlimited: false, streamIdleTimeoutMs: 300_000 }

  it('uses the product-wide finite budget when the provider omitted a policy', () => {
    expect(resolveProviderRetryPolicy(undefined, defaults, 'test')).toMatchObject({
      mode: 'normal',
      maxRetries: 5,
    })
  })

  it('maps unlimited onto always mode', () => {
    expect(resolveProviderRetryPolicy(undefined, { ...defaults, unlimited: true }, 'test')).toMatchObject({
      mode: 'always',
    })
  })

  it('keeps an explicit provider policy', () => {
    expect(resolveProviderRetryPolicy({ mode: 'normal', maxRetries: 1 }, defaults, 'test')).toMatchObject({
      mode: 'normal',
      maxRetries: 1,
    })
  })

  it('uses the product-wide idle interval when the provider omitted one', () => {
    expect(resolveStreamIdleTimeoutMs(undefined, defaults)).toBe(300_000)
    expect(resolveStreamIdleTimeoutMs(12_000, defaults)).toBe(12_000)
  })
})
