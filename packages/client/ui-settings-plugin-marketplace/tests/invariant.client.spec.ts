/** The package's node half and explained empty invariant companion. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as MarketplaceInvariant from '../src/invariant.ts'
import { apply as applyHost, inject, name } from '../src/host/index.ts'
import { apply as applyClientRow } from '../src/index.ts'

describe('invariant companion', () => {
  it('reserves package ownership with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(MarketplaceInvariant).await()).resolves.toBeDefined()
  })

  it('keeps Host identity on ./host and an empty package entry', () => {
    expect(name).toBe('plugin-marketplace')
    expect(inject).toEqual(['loader', 'profile', 'connection'])
    expect(typeof applyHost).toBe('function')
    expect(applyClientRow).not.toBe(applyHost)
  })
})
