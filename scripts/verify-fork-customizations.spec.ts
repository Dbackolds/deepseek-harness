/** Fork customizations must survive upstream merges. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyForkCustomizations } from './verify-fork-customizations.ts'

const root = join(import.meta.dirname, '..')
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function makeRepo(webAppPatch: string, catalogJson: string | null): string {
  const repo = mkdtempSync(join(tmpdir(), 'dsh-fork-repo-'))
  dirs.push(repo)
  mkdirSync(join(repo, 'packages', 'bundle', 'web-app'), { recursive: true })
  writeFileSync(join(repo, 'packages', 'bundle', 'web-app', 'cordis.patch.yml'), webAppPatch)
  writeFileSync(
    join(repo, 'packages', 'bundle', 'web-app', 'package.json'),
    '{"dependencies":{"@deepseek-ai/dsh-host-plugin-catalog":"workspace:^"}}',
  )
  mkdirSync(join(repo, 'packages', 'host', 'plugin-catalog'), { recursive: true })
  if (catalogJson !== null) {
    writeFileSync(join(repo, 'packages', 'host', 'plugin-catalog', 'catalog.json'), catalogJson)
  }
  return repo
}

const INTACT_PATCH = [
  '- id: plugin-inventory',
  "  name: '@deepseek-ai/dsh-host-plugin-inventory'",
  '- id: plugin-catalog',
  "  name: '@deepseek-ai/dsh-host-plugin-catalog'",
  '- id: plugin-marketplace',
  "  name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host'",
  '  config:',
  '    catalogUrls:',
  '      - /plugin-catalog/catalog.json',
  '',
].join('\n')

const INTACT_CATALOG = JSON.stringify({ version: 1, title: 'StarPivot', plugins: [{ name: 'x' }] })

describe('verifyForkCustomizations', () => {
  it('holds on this repository', () => {
    expect(verifyForkCustomizations(root)).toEqual([])
  })

  it('holds on a synthetic intact repo', () => {
    expect(verifyForkCustomizations(makeRepo(INTACT_PATCH, INTACT_CATALOG))).toEqual([])
  })

  it('fails when an upstream merge drops the plugin-catalog row', () => {
    const dropped = INTACT_PATCH
      .replace("- id: plugin-catalog\n  name: '@deepseek-ai/dsh-host-plugin-catalog'\n", '')
    const failed = verifyForkCustomizations(makeRepo(dropped, INTACT_CATALOG))
    expect(failed).toHaveLength(1)
    expect(failed[0]).toContain('plugin-catalog row')
  })

  it('fails when the catalog json loses the StarPivot title', () => {
    const failed = verifyForkCustomizations(makeRepo(INTACT_PATCH, JSON.stringify({ version: 1, title: 'Other', plugins: [] })))
    expect(failed.some(label => label.includes('catalog JSON'))).toBe(true)
  })
})
