// @vitest-environment jsdom
/** ui-session-history-gate apply wiring: settings dictionaries and General-section row. */
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { SettingsSchemaService } from '@deepseek-ai/dsh-client-ui-settings/src/client/schema.ts'
import { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/src/client/settings-scope.ts'
import { SettingsDescribeMirror } from '@deepseek-ai/dsh-client-ui-settings/src/client/settings-mirror.ts'
import { apply, inject } from '../src/client/index.ts'
import { NS } from '../src/client/locales.ts'
import { SessionHistoryGateRow } from '../src/client/SessionHistoryGateRow.tsx'
import type { SessionHistoryGateRowInjected } from '../src/client/SessionHistoryGateRow.tsx'

usePinnedBrowserLanguages('zh-CN')

const SLOT = 'settings.general.item'

const ENVELOPE = z.object({ enabled: z.boolean().default(false) }).toJSON()

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  let enabled = false
  let revision = 0
  const namespace = () => ({
    ns: 'session-history-tools',
    schema: ENVELOPE,
    value: { enabled },
    applies: 'live' as const,
    secrets: [],
    revision,
  })
  const describe = vi.fn(() => Promise.resolve({
    ok: true as const,
    value: { writable: true, hasDocument: true, namespaces: [namespace()] },
  }))
  const mutate = vi.fn((_ns: string, ops: readonly { path: string[]; value?: unknown }[]) => {
    for (const op of ops) {
      if (op.path[0] === 'enabled') enabled = op.value as boolean
    }
    revision += 1
    return Promise.resolve({ ok: true as const, value: namespace() })
  })
  new TestRemote(ctx, { settings: { describe, mutate } })
  const mirror = new SettingsDescribeMirror(ctx)
  await ctx.plugin(SettingsScopeBinder, {
    mirror, schema: new SettingsSchemaService(ctx), persistence: 'host',
  }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, mutate }
}

function declareItems(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

function faceOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(e => e.component === SessionHistoryGateRow)!
  const face = (entry.inject as unknown as () => SessionHistoryGateRowInjected)()
  return { entry, face }
}

describe('ui-session-history-gate apply', () => {
  it('declares the slot, locale, and settings services', () => {
    expect(inject).toEqual(['slots', 'locale', 'settingsScope'])
  })

  it('registers localized copy and the row from the described section', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.locale.bind(NS)('title')).toBe('会话历史工具')
    b.locale.setLocale('en')
    expect(b.locale.bind(NS)('title')).toBe('Session history tools')
    const { entry, face } = faceOf(b.slots)
    expect(entry.options).toMatchObject({ id: 'session-history-tools', order: 16 })
    await vi.waitFor(() => { expect(face.hooks.writable.getSnapshot()).toBe(true) })
    expect(face.hooks.enabled.getSnapshot()).toBe(false)
    expect(face.hooks.saving.getSnapshot()).toBe(false)
  })

  it('routes face writes through the Host settings scope', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const { face } = faceOf(b.slots)
    await vi.waitFor(() => { expect(face.hooks.writable.getSnapshot()).toBe(true) })
    face.setEnabled(true)
    expect(face.hooks.enabled.getSnapshot()).toBe(true)
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalled() })
    expect(b.mutate).toHaveBeenCalledWith(
      'session-history-tools',
      [{ op: 'set', path: ['enabled'], value: true }],
      0,
    )
    await vi.waitFor(() => { expect(face.hooks.saving.getSnapshot()).toBe(false) })
    expect(face.hooks.enabled.getSnapshot()).toBe(true)
  })

  it('teardown removes the row and the dictionaries', async () => {
    const b = await bench()
    declareItems(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries(SLOT)).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries(SLOT)).toHaveLength(0)
    expect(b.locale.bind(NS)('title')).toBe('title')
  })
})
