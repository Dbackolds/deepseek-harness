import { describe, expect, it } from 'vitest'
import { readProductVersion } from '../src/product-version.ts'

describe('readProductVersion', () => {
  it('prefers DSH_PRODUCT_VERSION when it is a non-empty string', () => {
    expect(readProductVersion({ DSH_PRODUCT_VERSION: '9.9.9' }, () => {
      throw new Error('must not read package.json')
    })).toBe('9.9.9')
  })

  it('skips a blank env override and reads the published CLI package', () => {
    expect(readProductVersion({ DSH_PRODUCT_VERSION: '' }, (id) => {
      if (id === '@deepseek-ai/dsh/package.json') return { version: '1.2.3' }
      throw new Error(id)
    })).toBe('1.2.3')
  })

  it('falls back to this package\'s package.json when the CLI is missing', () => {
    expect(readProductVersion({}, (id) => {
      if (id === '@deepseek-ai/dsh/package.json') throw new Error('missing')
      if (id === '../package.json') return { version: '0.1.2-alpha.1' }
      throw new Error(id)
    })).toBe('0.1.2-alpha.1')
  })

  it('skips empty version fields and falls back to 0.0.0', () => {
    expect(readProductVersion({}, (id) => {
      if (id === '@deepseek-ai/dsh/package.json') return { version: '' }
      if (id === '../package.json') return { version: 1 }
      throw new Error(id)
    })).toBe('0.0.0')
    expect(readProductVersion({}, () => { throw new Error('missing') })).toBe('0.0.0')
  })
})
