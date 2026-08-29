import { describe, expect, it } from 'vitest'
import { ProductUpdateSettingsSchema } from '../src/update-settings.ts'

describe('ProductUpdateSettingsSchema', () => {
  it('leaves an empty document empty', () => {
    expect(ProductUpdateSettingsSchema({})).toEqual({})
  })

  it('keeps lastResult.latest omitted when absent', () => {
    expect(ProductUpdateSettingsSchema({
      lastResult: {
        available: false,
        currentVersion: '1.2.3',
        checkedAt: 1,
        channel: 'dsh',
      },
    })).toEqual({
      lastResult: {
        available: false,
        currentVersion: '1.2.3',
        checkedAt: 1,
        channel: 'dsh',
      },
    })
  })
})
