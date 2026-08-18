import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as PolicyInvariant from '@deepseek-ai/dsh-client-ui-settings-llm-policy/invariant'

describe('ui-settings-llm-policy invariant', () => {
  it('registers the empty companion', async () => {
    const ctx = new Context()
    ctx.provide('invariants', { register: () => () => {} })
    await expect(ctx.plugin(PolicyInvariant).await()).resolves.toBeDefined()
  })
})
