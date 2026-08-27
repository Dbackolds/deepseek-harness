// @ts-nocheck — merge-port: client-runtime retirement; restore types in a follow-up.
// @vitest-environment jsdom
/** ui-settings-llm-policy apply wiring: settings dictionaries and General-section row. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { SettingsDescribeMirror } from '@deepseek-ai/dsh-client-ui-settings/src/client/settings-mirror.ts'
import { SettingsSchemaService } from '@deepseek-ai/dsh-client-ui-settings/src/client/schema.ts'
import { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/src/client/settings-scope.ts'
import { apply, inject, SETTINGS_NS } from '../src/client/index.ts'
import type { LlmPolicyRowInjected } from '../src/client/LlmPolicyRow.tsx'
import { LlmPolicyRow } from '../src/client/LlmPolicyRow.tsx'

usePinnedBrowserLanguages('zh-CN')

const SLOT = 'settings.general.item'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  let maxRetries = 5
  let unlimited = false
  let streamIdleTimeoutMs = 300_000
  const namespace = () => ({
    ns: 'llm-default-policy',
    schema: {
      type: 'object',
      properties: {
        maxRetries: { type: 'integer' },
        unlimited: { type: 'boolean' },
        streamIdleTimeoutMs: { type: 'number' },
      },
    },
    value: { maxRetries, unlimited, streamIdleTimeoutMs },
    applies: 'live' as const,
    secrets: [],
    revision: 0,
  })
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'policy-describe' as never,
    result: {
      ok: true as const,
      value: { writable: true, hasDocument: true, namespaces: [namespace()] },
    },
  }))
  const mutate = vi.fn((request: { ops: { path: string[]; value: unknown }[] }) => {
    const op = request.ops[0]!
    if (op.path[0] === 'maxRetries') maxRetries = op.value as number
    if (op.path[0] === 'unlimited') unlimited = op.value as boolean
    if (op.path[0] === 'streamIdleTimeoutMs') streamIdleTimeoutMs = op.value as number
    return Promise.resolve({
      rpcId: 'policy-mutate' as never,
      result: { ok: true as const, value: namespace() },
    })
  })
  ctx.provide('connection', { api: { settings: { describe, mutate } }, isLoopback: true } as never)
  new TestRemote(ctx)
  const connection = ctx.get('connection') as { api: never }
  const mirror = new SettingsDescribeMirror(connection.api)
  await ctx.plugin(SettingsScopeBinder, { mirror, schema: new SettingsSchemaService(ctx) }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, mutate }
}

function declareItems(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

function faceOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(e => e.component === LlmPolicyRow)!
  const face = (entry.inject as unknown as () => LlmPolicyRowInjected)()
  return { entry, face }
}

describe('ui-settings-llm-policy apply', () => {
  it('declares the slot, locale, and settings services', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope'])
  })

  it('registers localized copy and the row', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.locale.bind(SETTINGS_NS)('retries.title')).toBe('重试次数')
    b.locale.setLocale('en')
    expect(b.locale.bind(SETTINGS_NS)('retries.title')).toBe('Retry count')
    const { entry, face } = faceOf(b.slots)
    expect(entry.options).toMatchObject({ id: 'llm-policy', order: 15 })
    expect(face.hooks.maxRetries.getSnapshot()).toBe(5)
    expect(face.hooks.unlimited.getSnapshot()).toBe(false)
    expect(face.hooks.streamIdleTimeoutMs.getSnapshot()).toBe(300_000)
  })

  it('routes face writes through the Host settings scope', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const { face } = faceOf(b.slots)
    face.setMaxRetries(8)
    face.setUnlimited(true)
    face.setStreamIdleTimeoutMs(60_000)
    expect(face.hooks.maxRetries.getSnapshot()).toBe(8)
    expect(face.hooks.unlimited.getSnapshot()).toBe(true)
    expect(face.hooks.streamIdleTimeoutMs.getSnapshot()).toBe(60_000)
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalled() })
  })

  it('teardown removes the row and the dictionaries', async () => {
    const b = await bench()
    declareItems(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries(SLOT)).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries(SLOT)).toHaveLength(0)
    expect(b.locale.bind(SETTINGS_NS)('retries.title')).toBe('retries.title')
  })
})
