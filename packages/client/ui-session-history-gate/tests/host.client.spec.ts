import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

describe('ui-session-history-gate host', () => {
  it('loads as an empty host apply', async () => {
    const ctx = new Context()
    await expect(ctx.plugin({ apply }).await()).resolves.toBeDefined()
  })
})
