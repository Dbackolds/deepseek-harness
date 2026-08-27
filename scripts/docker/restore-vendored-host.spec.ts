/** Restore vendored packages that pnpm deploy omits from a Host tree. */

import { lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  VENDORED_HOST_DIRECTORIES,
  deployedPackagePath,
  restoreVendoredHostPackages,
  vendoredPackageName,
} from './restore-vendored-host.ts'

const root = join(import.meta.dirname, '../..')

describe('restoreVendoredHostPackages', () => {
  it('names every vendored Host package from vendor/*/package.json', () => {
    expect(VENDORED_HOST_DIRECTORIES).toContain('cosmokit')
    expect(VENDORED_HOST_DIRECTORIES).toContain('group')
    expect(vendoredPackageName(join(root, 'vendor', 'cosmokit'))).toBe('@deepseek-ai/cosmokit')
    expect(vendoredPackageName(join(root, 'vendor', 'group'))).toBe('@deepseek-ai/cordis-plugin-group')
    expect(deployedPackagePath('/out/dsh', '@deepseek-ai/cosmokit')).toBe(
      join('/out/dsh', 'node_modules', '@deepseek-ai', 'cosmokit'),
    )
  })

  it('copies omitted vendored packages into a deployed Host and leaves existing copies', () => {
    const deployed = mkdtempSync(join(tmpdir(), 'dsh-restore-vendored-'))
    mkdirSync(join(deployed, 'node_modules', '@deepseek-ai', 'cordis'), { recursive: true })
    writeFileSync(join(deployed, 'node_modules', '@deepseek-ai', 'cordis', 'package.json'), '{"name":"@deepseek-ai/cordis"}\n')
    writeFileSync(join(deployed, 'node_modules', '@deepseek-ai', 'cordis', 'marker'), 'keep\n')
    const copied = restoreVendoredHostPackages(deployed, root)
    expect(copied).toContain('@deepseek-ai/cosmokit')
    expect(copied).toContain('@deepseek-ai/cordis-plugin-group')
    expect(copied).not.toContain('@deepseek-ai/cordis')
    expect(existsSync(join(deployed, 'node_modules', '@deepseek-ai', 'cosmokit', 'package.json'))).toBe(true)
    expect(existsSync(join(deployed, 'node_modules', '@deepseek-ai', 'cordis', 'marker'))).toBe(true)
  })

  it('replaces a workspace symlink with a material vendored copy', () => {
    const deployed = mkdtempSync(join(tmpdir(), 'dsh-restore-symlink-'))
    const dest = join(deployed, 'node_modules', '@deepseek-ai', 'schemastery')
    mkdirSync(join(deployed, 'node_modules', '@deepseek-ai'), { recursive: true })
    symlinkSync(join(root, 'vendor', 'schemastery'), dest)
    expect(lstatSync(dest).isSymbolicLink()).toBe(true)
    const copied = restoreVendoredHostPackages(deployed, root)
    expect(copied).toContain('@deepseek-ai/schemastery')
    expect(lstatSync(dest).isSymbolicLink()).toBe(false)
    expect(JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).name).toBe('@deepseek-ai/schemastery')
  })
})
