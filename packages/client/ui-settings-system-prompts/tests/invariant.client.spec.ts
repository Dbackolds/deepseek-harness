/** The package's node half: an empty host body and an explained empty invariant companion. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as PluginConfigInvariant from '@deepseek-ai/dsh-client-ui-settings-system-prompts/invariant'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(PluginConfigInvariant).await()).resolves.toBeDefined()
  })

  it('has an empty node half', async () => {
    const { apply } = await import('@deepseek-ai/dsh-client-ui-settings-system-prompts')
    apply()
    expect(typeof apply).toBe('function')
  })
})
