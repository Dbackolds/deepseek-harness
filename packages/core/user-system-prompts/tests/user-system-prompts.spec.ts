/** User system-prompt library layered over a real settings provider. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import UserSystemPrompts, {
  applyUserSystemPrompts,
  USER_SYSTEM_PROMPTS_SETTINGS_NAMESPACE,
  validateUserSystemPrompts,
} from '../src/index.ts'

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

const STYLE = { id: 'style', name: 'Style', text: 'Be concise.' }
const RULES = { id: 'rules', name: 'Rules', text: 'Never guess.' }

async function boot(): Promise<{ ctx: Context }> {
  const ctx = new Context()
  await ctx.plugin(MemorySettings).await()
  await ctx.plugin(SystemPrompt, { persona: 'You are the deployment persona.' })
  await ctx.plugin(UserSystemPrompts)
  ctx.systemPrompt.variable('provider', () => 'deepseek-official')
  ctx.systemPrompt.variable('model', () => 'deepseek-v4-flash')
  return { ctx }
}

describe('validateUserSystemPrompts', () => {
  it('accepts a unique library and one binding per model', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE, RULES],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style', 'rules'],
        override: false,
      }],
    })).not.toThrow()
  })

  it('rejects a duplicate prompt id', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE, { ...RULES, id: 'style' }],
      bindings: [],
    })).toThrow('listed more than once')
  })

  it('rejects an invalid prompt id', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [{ id: '1bad', name: 'Bad', text: 'x' }],
      bindings: [],
    })).toThrow('must match')
  })

  it('rejects an empty prompt name', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [{ id: 'style', name: '  ', text: 'x' }],
      bindings: [],
    })).toThrow('needs a name')
  })

  it('rejects a binding without provider or model', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE],
      bindings: [{ provider: '', model: 'm', promptIds: [], override: false }],
    })).toThrow('needs both provider and model')
  })

  it('rejects two bindings for the same model', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE],
      bindings: [
        { provider: 'p', model: 'm', promptIds: ['style'], override: false },
        { provider: 'p', model: 'm', promptIds: [], override: true },
      ],
    })).toThrow('more than one binding')
  })

  it('rejects a binding that lists one prompt twice', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE],
      bindings: [{
        provider: 'p',
        model: 'm',
        promptIds: ['style', 'style'],
        override: false,
      }],
    })).toThrow('more than once')
  })

  it('rejects an unknown binding reference', () => {
    expect(() => validateUserSystemPrompts({
      prompts: [STYLE],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['missing'],
        override: false,
      }],
    })).toThrow('unknown prompt "missing"')
  })
})

describe('applyUserSystemPrompts', () => {
  const settings = {
    prompts: [STYLE, RULES],
    bindings: [{
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      promptIds: ['rules', 'style'],
      override: false,
    }],
  }

  it('appends selected prompts in listed order', () => {
    const result = applyUserSystemPrompts(
      { sections: [{ name: 'base', text: 'base' }], contexts: [], tools: [], variables: {} },
      settings,
      'deepseek-official',
      'deepseek-v4-flash',
    )
    expect(result.sections).toEqual([
      { name: 'base', text: 'base' },
      { name: 'user-system-prompt:rules', text: 'Never guess.' },
      { name: 'user-system-prompt:style', text: 'Be concise.' },
    ])
  })

  it('replaces the assembled prompt when override is set', () => {
    const result = applyUserSystemPrompts(
      { sections: [{ name: 'base', text: 'base' }], contexts: [], tools: [], variables: {} },
      { ...settings, bindings: [{ ...settings.bindings[0]!, override: true }] },
      'deepseek-official',
      'deepseek-v4-flash',
    )
    expect(result.sections).toEqual([
      { name: 'user-system-prompt:rules', text: 'Never guess.' },
      { name: 'user-system-prompt:style', text: 'Be concise.' },
    ])
  })

  it('leaves an assembly without provider or model unchanged', () => {
    const assembly = { sections: [{ name: 'base', text: 'base' }], contexts: [], tools: [], variables: {} }
    expect(applyUserSystemPrompts(assembly, settings, undefined, 'm')).toBe(assembly)
    expect(applyUserSystemPrompts(assembly, settings, '', 'm')).toBe(assembly)
  })

  it('leaves an unmatched model unchanged', () => {
    const assembly = { sections: [{ name: 'base', text: 'base' }], contexts: [], tools: [], variables: {} }
    expect(applyUserSystemPrompts(assembly, settings, 'other', 'model')).toBe(assembly)
  })

  it('drops a selected id that is no longer in the library', () => {
    const result = applyUserSystemPrompts(
      { sections: [{ name: 'base', text: 'base' }], contexts: [], tools: [], variables: {} },
      {
        prompts: [STYLE],
        bindings: [{
          provider: 'deepseek-official',
          model: 'deepseek-v4-flash',
          promptIds: ['missing'],
          override: false,
        }],
      },
      'deepseek-official',
      'deepseek-v4-flash',
    )
    expect(result.sections).toEqual([{ name: 'base', text: 'base' }])
  })
})

describe('UserSystemPrompts', () => {
  it('appends the bound prompts for the assembled model', async () => {
    const { ctx } = await boot()
    await ctx.settings.replace(USER_SYSTEM_PROMPTS_SETTINGS_NAMESPACE, {
      prompts: [STYLE, RULES],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style', 'rules'],
        override: false,
      }],
    })

    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.sections.map(section => section.name)).toEqual([
      'harness:identity',
      'deployment:persona',
      'user-system-prompt:style',
      'user-system-prompt:rules',
    ])
    expect(renderPrompt(assembly)).toContain('Be concise.')
    await ctx.fiber.dispose()
  })

  it('overrides a complete preset persona when the binding says so', async () => {
    const { ctx } = await boot()
    ctx.systemPrompt.section({
      name: 'preset:persona',
      order: 1,
      text: 'Exact preset prompt.',
      complete: true,
    })
    await ctx.settings.replace(USER_SYSTEM_PROMPTS_SETTINGS_NAMESPACE, {
      prompts: [STYLE],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style'],
        override: true,
      }],
    })

    expect((await ctx.systemPrompt.assemble()).sections).toEqual([
      { name: 'user-system-prompt:style', text: 'Be concise.' },
    ])
    await ctx.fiber.dispose()
  })

  it('leaves assembly alone when the library is empty', async () => {
    const { ctx } = await boot()
    expect((await ctx.systemPrompt.assemble()).sections.map(section => section.name))
      .toEqual(['harness:identity', 'deployment:persona'])
    expect(ctx.userSystemPrompts.current()).toEqual({ prompts: [], bindings: [] })
    await ctx.fiber.dispose()
  })
})
