import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as DefaultPolicyInvariant from '@deepseek-ai/dsh-llm-default-policy/invariant'

describe('llm-default-policy invariant', () => {
  it('registers the empty companion', async () => {
    const ctx = new Context()
    ctx.provide('invariants', { register: () => () => {} })
    await expect(ctx.plugin(DefaultPolicyInvariant).await()).resolves.toBeDefined()
  })
})
