import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillSessionControl from '@deepseek-ai/dsh-skill-session-control'

const DESCRIPTION = 'Search every session, read whether it is running, stop a turn, send a later message, rename a conversation, or archive, unarchive, and regroup conversations. Use when the user asks about other sessions, wants the conversation library managed, or names a session to interrupt or continue.'

describe('dsh-skill-session-control', () => {
  it('registers and disposes the bundled session-control skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillSessionControl)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'dsh-session-control',
      description: DESCRIPTION,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'dsh-session-control',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('dsh-session-control')
    expect(loaded?.content).toContain('session_control_search')
    expect(loaded?.content).toContain('session_control_stop')
    expect(loaded?.content).toContain('session_control_send')
    expect(loaded?.content).toContain('session_control_archive')
    expect(loaded?.content).toContain('session_control_unarchive')
    expect(loaded?.content).toContain('session_control_rehome')
    expect(loaded?.content).toContain('session_control_reorder')
    expect(loaded?.content).toContain('session_control_workspaces')
    expect(loaded?.content).toContain('session_control_rename')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })
})
