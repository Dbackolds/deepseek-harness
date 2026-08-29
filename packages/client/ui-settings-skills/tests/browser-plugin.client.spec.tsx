// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { SkillsSection } from '../src/client/SkillsSection.tsx'
import type { SkillsSectionInjected } from '../src/client/SkillsSection.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const EMPTY = { skills: [] }
type CatalogResult =
  | { readonly ok: true; readonly value: typeof EMPTY }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const catalog = vi.fn<(args: { readonly sessionId: never }) => Promise<CatalogResult>>()
    .mockResolvedValue({ ok: true, value: EMPTY })
  ctx.provide('connection', {})
  ctx.provide('remote', { skills: { list: catalog } })
  ctx.provide('remote.skills', { list: catalog } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, catalog }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-skills browser plugin', () => {
  it('declares only the services used by the Settings contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'remote.skills'])
  })

  it('registers a localized section between Plugins and Agent presets', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.section')[0]!
    expect(entry.component).toBe(SkillsSection)
    expect(entry.options).toMatchObject({ id: 'skills', order: 17 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('Skills')
    expect(b.catalog).not.toHaveBeenCalled()

    const injected = (entry.inject as unknown as () => SkillsSectionInjected)()
    await expect(injected.list()).resolves.toEqual([])
    expect(b.catalog).toHaveBeenCalledOnce()
    b.catalog.mockResolvedValueOnce({
      ok: false, error: { code: 'internal', message: 'unavailable' },
    })
    await expect(injected.list()).rejects.toThrow('skills.list failed: internal: unavailable')
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
    expect(resolveSlotLabel(b.slots.entries('settings.section')[0]!.options.label)).toBe('Skills')

    stop()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.section')[0]?.component).toBe(SkillsSection)
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
