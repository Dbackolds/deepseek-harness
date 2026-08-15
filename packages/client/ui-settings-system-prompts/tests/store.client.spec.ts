/** Library writes and per-model bindings go through settings.replace. */

import { describe, expect, it, vi } from 'vitest'
import type { IApiClient, RpcId, RpcResponse, SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import { bindingFor, messageOf, refreshIfLoaded, slugFromName, SystemPromptsStore } from '../src/client/store.ts'

function ok<T>(value: T): RpcResponse<T> {
  return { rpcId: 'r' as RpcId, result: { ok: true, value } }
}

function view(section: { prompts: unknown[]; bindings: unknown[] }, revision = 1): SettingsNamespaceView {
  return {
    ns: 'user-system-prompts',
    schema: {},
    value: section,
    applies: 'live',
    secrets: [],
    revision,
  }
}

function api(initial = { prompts: [] as unknown[], bindings: [] as unknown[] }): {
  settings: Pick<IApiClient, 'settings'>['settings']
  llm: Pick<IApiClient, 'llm'>['llm']
  replace: ReturnType<typeof vi.fn>
} {
  let current = view(initial)
  const replace = vi.fn(async (payload: { section: { prompts: unknown[]; bindings: unknown[] } }) => {
    current = view(payload.section, current.revision + 1)
    return ok(current)
  })
  return {
    settings: {
      describe: vi.fn(async () => ok({ writable: true, hasDocument: true, namespaces: [current] })),
      replace,
    },
    llm: {
      models: vi.fn(async () => ok({
        groups: [{
          id: 'deepseek-official',
          name: 'DeepSeek',
          models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }],
        }],
        failures: [],
      })),
    },
    replace,
  } as unknown as {
    settings: Pick<IApiClient, 'settings'>['settings']
    llm: Pick<IApiClient, 'llm'>['llm']
    replace: ReturnType<typeof vi.fn>
  }
}

describe('messageOf', () => {
  it('stringifies a non-Error rejection', () => {
    expect(messageOf(new Error('boom'))).toBe('boom')
    expect(messageOf('plain')).toBe('plain')
  })
})

describe('slugFromName', () => {
  it('slugs a display name and avoids collisions', () => {
    expect(slugFromName('Be concise', [])).toBe('be-concise')
    expect(slugFromName('Be concise', ['be-concise'])).toBe('be-concise-2')
    expect(slugFromName('!!!', [])).toBe('prompt')
  })
})

describe('bindingFor', () => {
  it('returns the stored row or an empty selection', () => {
    const stored = { provider: 'p', model: 'm', promptIds: ['a'], override: true }
    expect(bindingFor([stored], 'p', 'm')).toEqual(stored)
    expect(bindingFor([stored], 'p', 'other')).toEqual({
      provider: 'p', model: 'other', promptIds: [], override: false,
    })
  })
})

describe('SystemPromptsStore', () => {
  it('loads the library, bindings, and catalog', async () => {
    const wire = api({
      prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style'],
        override: true,
      }],
    })
    const store = new SystemPromptsStore(wire)
    await store.load()
    const snapshot = store.store.getSnapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.prompts).toEqual([{ id: 'style', name: 'Style', text: 'Be concise.' }])
    expect(snapshot.catalog).toEqual([{
      provider: 'deepseek-official',
      providerName: 'DeepSeek',
      model: 'deepseek-v4-flash',
      modelName: 'DeepSeek V4 Flash',
    }])
    expect(snapshot.bindings[0]?.override).toBe(true)
    store.dispose()
    refreshIfLoaded(store)
  })

  it('ignores malformed library and binding rows', async () => {
    const wire = api({
      prompts: [null, { id: 1 }, { id: 'ok', name: 'Ok' }, { id: 'named', name: 'Named', text: 3 }],
      bindings: [null, { provider: 'p' }, { provider: 'p', model: 'm' }, {
        provider: 'p',
        model: 'n',
        promptIds: ['ok', 2],
        override: false,
      }],
    })
    const store = new SystemPromptsStore(wire)
    await store.load()
    expect(store.store.getSnapshot().prompts).toEqual([
      { id: 'ok', name: 'Ok', text: '' },
      { id: 'named', name: 'Named', text: '' },
    ])
    expect(store.store.getSnapshot().bindings).toEqual([
      { provider: 'p', model: 'm', promptIds: [], override: false },
      { provider: 'p', model: 'n', promptIds: ['ok'], override: false },
    ])
  })

  it('creates a prompt through settings.replace', async () => {
    const wire = api()
    const store = new SystemPromptsStore(wire)
    await store.load()
    store.beginCreate()
    store.setDraftName('Style')
    store.setDraftText('Be concise.')
    await store.saveDraft()
    expect(wire.replace).toHaveBeenCalledWith(expect.objectContaining({
      ns: 'user-system-prompts',
      section: {
        prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
        bindings: [],
      },
    }))
    expect(store.store.getSnapshot().draft).toBeNull()
    expect(store.store.getSnapshot().prompts).toHaveLength(1)
  })

  it('refuses an empty draft name', async () => {
    const wire = api()
    const store = new SystemPromptsStore(wire)
    await store.load()
    store.beginCreate()
    store.setDraftText('text')
    await store.saveDraft()
    expect(wire.replace).not.toHaveBeenCalled()
    expect(store.store.getSnapshot().draft?.error).toBe('nameRequired')
  })

  it('writes selected ids and override for one model', async () => {
    const wire = api({
      prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
      bindings: [],
    })
    const store = new SystemPromptsStore(wire)
    await store.load()
    await store.setPromptIds('deepseek-official', 'deepseek-v4-flash', ['style'])
    await store.setOverride('deepseek-official', 'deepseek-v4-flash', true)
    expect(wire.replace.mock.calls.at(-1)?.[0].section.bindings).toEqual([{
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      promptIds: ['style'],
      override: true,
    }])
  })

  it('edits an existing prompt and cancels a draft', async () => {
    const wire = api({
      prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
      bindings: [],
    })
    const store = new SystemPromptsStore(wire)
    await store.load()
    store.beginEdit('style')
    store.setDraftName('Voice')
    store.setDraftText('Speak plainly.')
    await store.saveDraft()
    expect(wire.replace).toHaveBeenCalledWith(expect.objectContaining({
      section: {
        prompts: [{ id: 'style', name: 'Voice', text: 'Speak plainly.' }],
        bindings: [],
      },
    }))
    store.beginCreate()
    store.cancelDraft()
    expect(store.store.getSnapshot().draft).toBeNull()
  })

  it('refuses an empty draft text and reports a failed write', async () => {
    const wire = api()
    const store = new SystemPromptsStore(wire)
    await store.load()
    store.beginCreate()
    store.setDraftName('Style')
    await store.saveDraft()
    expect(store.store.getSnapshot().draft?.error).toBe('textRequired')

    wire.replace.mockRejectedValueOnce(new Error('conflict'))
    store.setDraftText('Be concise.')
    await store.saveDraft()
    expect(store.store.getSnapshot().draft?.error).toBe('conflict')
  })

  it('keeps a catalog error while the library stays editable', async () => {
    const wire = api()
    wire.llm.models = vi.fn(async () => ({
      rpcId: 'm' as RpcId,
      result: { ok: false, error: { message: 'down' } },
    })) as unknown as typeof wire.llm.models
    const store = new SystemPromptsStore(wire)
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({
      status: 'ready',
      catalogError: 'down',
      catalog: [],
    })
  })

  it('surfaces a missing namespace and a catalog failure', async () => {
    const store = new SystemPromptsStore({
      settings: {
        describe: vi.fn(async () => ok({ writable: true, hasDocument: true, namespaces: [] })),
        replace: vi.fn(),
      },
      llm: {
        models: vi.fn(async () => ({ rpcId: 'm' as RpcId, result: { ok: false, error: { message: 'catalog down' } } })),
      },
    } as never)
    await store.load()
    expect(store.store.getSnapshot().status).toBe('unavailable')

    const failing = new SystemPromptsStore({
      settings: {
        describe: vi.fn(async () => { throw new Error('describe failed') }),
        replace: vi.fn(),
      },
      llm: { models: vi.fn(async () => ok({ groups: [], failures: [] })) },
    } as never)
    await failing.load()
    expect(failing.store.getSnapshot()).toMatchObject({ status: 'error', error: 'describe failed' })
  })

  it('drops a deleted prompt from every binding', async () => {
    const wire = api({
      prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style'],
        override: false,
      }],
    })
    const store = new SystemPromptsStore(wire)
    await store.load()
    store.confirmDelete('style')
    await store.remove()
    expect(wire.replace).toHaveBeenCalledWith(expect.objectContaining({
      section: { prompts: [], bindings: [] },
    }))
  })
})
