import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as WorkspaceInvariant from '@deepseek-ai/dsh-client-ui-workspace/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(WorkspaceInvariant).await()).resolves.toBeDefined()
  })

  it('node-half apply registers the settings section when settings is present', async () => {
    const { apply } = await import('@deepseek-ai/dsh-client-ui-workspace')
    const ctx = new Context()
    const register = vi.fn()
    ctx.provide('settings', { register } as never)
    apply(ctx)
    await Promise.resolve()
    expect(register).toHaveBeenCalled()
  })
})
