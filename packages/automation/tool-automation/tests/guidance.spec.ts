import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as toolAutomation from '../src/index.ts'

const GUIDANCE = 'automation_create may infer that intent from a direct human request'

async function harness() {
  const ctx = new Context()
  ctx.provide('automation', { list: () => [] })
  ctx.provide('workspaceRegistry', { list: () => [] })
  ctx.provide('agents', { roots: () => [] })
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const fiber = await ctx.plugin(toolAutomation)
  return { ctx, fiber }
}

describe('automation tool guidance', () => {
  it('registers infer-intent guidance and disposes it with the plugin', async () => {
    const { ctx, fiber } = await harness()
    const section = (await ctx.systemPrompt.assemble()).sections.find(item => item.name === 'tool:automation')
    expect(section?.text).toContain(GUIDANCE)
    expect(section?.text).toContain('Do not start the requested work in this session')
    expect(ctx.tools.get('automation_create')).toBeUndefined()

    await fiber.dispose()
    expect((await ctx.systemPrompt.assemble()).sections.some(item => item.name === 'tool:automation')).toBe(false)
  })

  it('describes create as inferred Host Automation intent', async () => {
    const ctx = new Context()
    ctx.provide('automation', { list: () => [] })
    ctx.provide('workspaceRegistry', { list: () => [] })
    ctx.provide('agents', { roots: () => [] })
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    toolAutomation.registerAutomationTools(ctx, ctx)
    expect(ctx.tools.get('automation_create')?.description).toContain('Infer this intent')
    expect(ctx.tools.get('automation_create')?.description).toContain('Do not start the work in this session')
  })

  it('has the Loader-safe namespace export shape', () => {
    expect('default' in toolAutomation).toBe(false)
    expect(toolAutomation.name).toBe('tool-automation')
    expect(toolAutomation.inject).toEqual(['agents', 'automation', 'systemPrompt', 'tools', 'workspaceRegistry'])
    const loader = Object.create(Loader.prototype) as Loader
    expect(loader.unwrapExports(toolAutomation)).toBe(toolAutomation)
  })
})
