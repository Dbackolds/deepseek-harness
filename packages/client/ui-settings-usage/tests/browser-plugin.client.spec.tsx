// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { UsageSection } from '../src/client/UsageSection.tsx'
import type { UsageSectionInjected } from '../src/client/UsageSection.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const EMPTY = {
  tokens: 0, peakTokens: 0, durationMs: 0, peakDurationMs: 0,
  currentStreakDays: 0, longestStreakDays: 0,
  firstActivityAt: null, lastActivityAt: null, days: [], models: [],
}
type OverviewResult =
  | { readonly ok: true; readonly value: typeof EMPTY }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const overview = vi.fn<(args: { readonly timeZone: string }) => Promise<OverviewResult>>()
    .mockResolvedValue({ ok: true, value: EMPTY })
  ctx.provide('connection', {})
  ctx.provide('remote', { usage: { overview } })
  ctx.provide('remote.usage', { overview } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, overview }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-usage browser plugin', () => {
  it('declares only the services used by the Settings contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'remote.usage'])
    expect(hostApply()).toBeUndefined()
  })

  it('registers a localized section after Skills', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(UsageSection)
    expect(entry.options).toMatchObject({ id: 'usage', order: 35 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('使用统计')
    expect(b.overview).not.toHaveBeenCalled()
    const injected = (entry.inject as unknown as () => UsageSectionInjected)()
    await expect(injected.load('UTC')).resolves.toEqual(EMPTY)
    expect(b.overview).toHaveBeenCalledOnce()
    b.overview.mockResolvedValueOnce({
      ok: false, error: { code: 'internal', message: 'unavailable' },
    })
    await expect(injected.load('UTC')).rejects.toThrow('usage.overview failed: internal: unavailable')
    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration and teardown', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    const stop = declare(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.section')).toHaveLength(1) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.section')[0]!.options.label)).toBe('Usage')
    stop()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.section')[0]?.component).toBe(UsageSection)
    })
    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
