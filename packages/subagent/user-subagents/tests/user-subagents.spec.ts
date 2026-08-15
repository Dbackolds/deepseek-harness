/** User subagent-definition library layered over a real settings provider. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import UserSubagents, {
  compositionFromUserSubagent,
  findUserSubagent,
  USER_SUBAGENTS_SETTINGS_NAMESPACE,
  validateUserSubagents,
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

const REVIEWER = {
  id: 'reviewer',
  name: 'Reviewer',
  description: 'Reviews a change without editing it.',
  persona: 'You are a careful code reviewer.',
  deny: ['edit', 'write'],
}

async function boot(): Promise<{ ctx: Context }> {
  const ctx = new Context()
  await ctx.plugin(MemorySettings).await()
  await ctx.plugin(UserSubagents)
  return { ctx }
}

describe('validateUserSubagents', () => {
  it('accepts a unique library', () => {
    expect(() => validateUserSubagents({ definitions: [REVIEWER] })).not.toThrow()
  })

  it('rejects a duplicate id', () => {
    expect(() => validateUserSubagents({
      definitions: [REVIEWER, { ...REVIEWER, name: 'Other' }],
    })).toThrow('listed more than once')
  })

  it('rejects an invalid id', () => {
    expect(() => validateUserSubagents({
      definitions: [{ ...REVIEWER, id: '1bad' }],
    })).toThrow('must match')
  })

  it('rejects an empty name', () => {
    expect(() => validateUserSubagents({
      definitions: [{ ...REVIEWER, name: '  ' }],
    })).toThrow('needs a name')
  })

  it('rejects an empty allow or deny name', () => {
    expect(() => validateUserSubagents({
      definitions: [{ ...REVIEWER, allow: [''] }],
    })).toThrow('empty allow name')
    expect(() => validateUserSubagents({
      definitions: [{ id: 'reader', name: 'Reader', description: '', persona: 'x', deny: [''] }],
    })).toThrow('empty deny name')
  })

  it('accepts a non-empty allow list', () => {
    expect(() => validateUserSubagents({
      definitions: [{ ...REVIEWER, allow: ['read'], deny: ['edit'] }],
    })).not.toThrow()
  })
})

describe('findUserSubagent and compositionFromUserSubagent', () => {
  it('returns undefined for a missing id', () => {
    expect(findUserSubagent({ definitions: [REVIEWER] }, 'missing')).toBeUndefined()
  })

  it('omits toolFilter when neither allow nor deny is set', () => {
    expect(compositionFromUserSubagent({
      id: 'plain',
      name: 'Plain',
      description: '',
      persona: 'You are a helper.',
    })).toEqual({ persona: 'You are a helper.' })
  })

  it('preserves a deny-only filter without materializing allow', () => {
    expect(compositionFromUserSubagent(REVIEWER)).toEqual({
      persona: 'You are a careful code reviewer.',
      toolFilter: { deny: ['edit', 'write'] },
    })
  })

  it('preserves an allow-only filter', () => {
    expect(compositionFromUserSubagent({
      id: 'reader',
      name: 'Reader',
      description: '',
      persona: 'Read only.',
      allow: ['read'],
    })).toEqual({
      persona: 'Read only.',
      toolFilter: { allow: ['read'] },
    })
  })
})

describe('UserSubagents', () => {
  it('returns an empty library until Settings supplies definitions', async () => {
    const { ctx } = await boot()
    expect(ctx.userSubagents.current()).toEqual({ definitions: [] })
    expect(ctx.userSubagents.get('reviewer')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('serves a stored definition through current() and get()', async () => {
    const { ctx } = await boot()
    await ctx.settings.replace(USER_SUBAGENTS_SETTINGS_NAMESPACE, {
      definitions: [REVIEWER],
    })
    expect(ctx.userSubagents.current()).toEqual({ definitions: [REVIEWER] })
    expect(ctx.userSubagents.get('reviewer')).toEqual(REVIEWER)
    await ctx.fiber.dispose()
  })
})
