/** What the browser half registers, and that it all leaves with the fiber. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-settings-system-prompts/client'
import type { SystemPromptsSectionInjected } from '@deepseek-ai/dsh-client-ui-settings-system-prompts/client'

usePinnedBrowserLanguages('zh-CN')

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  new TestRemote(ctx)
  ctx.provide('remote.settings', { describe: vi.fn(() => Promise.resolve({ rpcId: 's', result: { ok: false, error: { message: 'no' } } })) } as never)
  ctx.provide('remote.llm', { listProviders: vi.fn(() => Promise.resolve({ rpcId: 'm', result: { ok: false, error: { message: 'no' } } })) } as never)
  ctx.provide('remote.systemPrompt', { list: vi.fn(() => Promise.resolve({ rpcId: 'p', result: { ok: false, error: { message: 'no' } } })) } as never)
  ctx.provide('connection', {
    isLoopback: true,
    api: {
      settings: { describe: vi.fn(() => Promise.resolve({ rpcId: 's', result: { ok: false, error: { message: 'no' } } })) },
      llm: { models: vi.fn(() => Promise.resolve({ rpcId: 'm', result: { ok: false, error: { message: 'no' } } })) },
      systemPrompt: { list: vi.fn(() => Promise.resolve({ rpcId: 'p', result: { ok: false, error: { message: 'no' } } })) },
    },
  } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry }
}

function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-system-prompts apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'remote.settings', 'remote.llm', 'remote.systemPrompt'])
  })

  it('registers one System prompts section after Agent presets', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const section = slots.entries('settings.section')[0]!
    expect(section.options).toMatchObject({ id: 'system-prompts', order: 25 })
    expect(resolveSlotLabel(section.options.label)).toBe('系统提示词')
    const face = (section.inject as unknown as () => SystemPromptsSectionInjected)()
    face.beginCreate()
    face.beginEdit('missing')
    face.beginEditBuiltIn('harness:identity')
    await face.resetBuiltIn('harness:identity')
    face.cancelDraft()
    face.setDraftName('n')
    face.setDraftText('t')
    face.confirmDelete(null)
    await face.saveDraft()
    await face.remove()
    await face.setPromptIds('p', 'm', [])
    await face.setOverride('p', 'm', false)
    expect(typeof face.load).toBe('function')
    ctx.emit('settings/document-updated' as never, ['user-system-prompts'])
    ctx.emit('settings/document-updated' as never, ['other'])
    ctx.emit('llm/adapters-updated' as never, [])
    ctx.emit('connection/reset')
    await face.load()
    ctx.emit('settings/document-updated' as never, ['user-system-prompts'])
  })

  it('unregisters the section with the fiber', async () => {
    const { ctx, slots } = await bench()
    declareRoot(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(slots.entries('settings.section')).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries('settings.section')).toHaveLength(0)
  })
})
