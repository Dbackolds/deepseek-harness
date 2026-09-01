import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as UpdateInvariant from '@deepseek-ai/dsh-client-ui-update/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(UpdateInvariant).await()).resolves.toBeDefined()
  })
})
