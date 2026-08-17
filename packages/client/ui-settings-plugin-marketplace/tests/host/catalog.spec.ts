import { describe, expect, it } from 'vitest'
import { BUILTIN_CATALOG_PATH, isCatalogUrl, parseCatalogDocument, sourceTitleFromUrl } from '../../src/host/catalog.ts'
import { DEFAULT_CATALOG_URL } from '../../src/host/defaults.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const parsed = parseCatalogDocument({
  version: 1,
  title: 'StarPivot',
  plugins: [{
    name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace',
    version: '0.1.12',
    title: 'Plugin marketplace',
    description: 'Replace the shipped Plugins settings page.',
    homepage: 'https://github.com/StarPivotNet/dsh-plugins-public',
    kind: 'bundle',
    updatedAt: '2026-08-16T17:52:31.074Z',
  }],
}, 'https://example.com/catalog.json')
assert(parsed.ok, 'valid listing with updatedAt')
if (parsed.ok) {
  assert(parsed.entries[0]?.updatedAt === '2026-08-16T17:52:31.074Z', 'keeps the publish time')
}

const omitted = parseCatalogDocument({
  version: 1,
  plugins: [{
    name: 'dsh-find-plugin',
    version: '0.3.6',
    title: 'Find plugins',
    description: '',
    kind: 'bundle',
  }],
}, 'https://example.com/catalog.json')
assert(omitted.ok, 'updatedAt stays optional')
if (omitted.ok) assert(omitted.entries[0]?.updatedAt === undefined, 'omitted stamp is absent')

const invalid = parseCatalogDocument({
  version: 1,
  plugins: [{
    name: 'dsh-find-plugin',
    version: '0.3.6',
    title: 'Find plugins',
    description: '',
    kind: 'bundle',
    updatedAt: 'yesterday',
  }],
}, 'https://example.com/catalog.json')
assert(!invalid.ok, 'rejects a non-ISO updatedAt')
if (!invalid.ok) assert(invalid.message.includes('updatedAt'), 'names the field')



describe('catalog', () => {
  it('holds the imported assertions', () => {})

  it('accepts the shipped Host catalog path', () => {
    expect(DEFAULT_CATALOG_URL).toBe(BUILTIN_CATALOG_PATH)
    expect(isCatalogUrl(BUILTIN_CATALOG_PATH)).toBe(true)
    expect(isCatalogUrl('https://example.com/catalog.json')).toBe(true)
    expect(isCatalogUrl('file:///tmp/catalog.json')).toBe(false)
    expect(sourceTitleFromUrl(BUILTIN_CATALOG_PATH)).toBe('StarPivot')
  })
})
