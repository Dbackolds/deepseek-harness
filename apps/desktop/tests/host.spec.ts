import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findRepoRoot, packagedHostRoot, resolveDshInvocation, resolveNodeExecutable } from '../src/host.ts'
import { desktopIconPath } from '../src/icon.ts'
import { windowsShortcutPath, windowsShortcutSpec } from '../src/shortcut.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('desktop host resolution', () => {
  it('walks from the desktop package to the repository root', () => {
    const root = findRepoRoot(here)
    expect(existsSync(join(root, 'apps', 'cli', 'package.json'))).toBe(true)
    expect(resolveDshInvocation(here).command).toBe(resolveNodeExecutable())
    expect(resolveNodeExecutable(process.execPath)).toBe(process.execPath)
    expect(resolveDshInvocation(here).args.at(-1)?.replaceAll('\\', '/'))
      .toMatch(/apps\/cli\/(?:lib\/bin\.js|src\/bin\.ts)$/)
  })

  it('rejects a directory that is not this checkout', () => {
    expect(() => findRepoRoot(join(tmpdir(), 'dsh-desktop-not-a-checkout'))).toThrow(/cannot locate the repository root/)
  })

  it('treats extraResources/host with a CLI bin as a packaged Host', () => {
    const resources = mkdtempSync(join(tmpdir(), 'dsh-desktop-resources-'))
    const bin = join(resources, 'host', 'dsh', 'lib', 'bin.js')
    mkdirSync(dirname(bin), { recursive: true })
    writeFileSync(bin, '')
    expect(packagedHostRoot(resources)?.replaceAll('\\', '/')).toMatch(/\/host$/)
    expect(packagedHostRoot(join(tmpdir(), 'dsh-desktop-empty-resources'))).toBeUndefined()
    const nodeName = process.platform === 'win32' ? 'node.exe' : 'node'
    const bundled = join(resources, 'host', nodeName)
    writeFileSync(bundled, '')
    expect(resolveNodeExecutable(undefined, join(resources, 'host'))).toBe(bundled)
  })

  it('ships the DeepSeek whale mark next to the desktop package', () => {
    const assets = join(findRepoRoot(here), 'apps', 'desktop', 'assets')
    expect(existsSync(join(assets, 'icon.png'))).toBe(true)
    expect(existsSync(join(assets, 'icon-512.png'))).toBe(true)
    expect(existsSync(join(assets, 'icon.ico'))).toBe(true)
    expect(desktopIconPath(join(assets, '..', 'lib')).replaceAll('\\', '/')).toMatch(/apps\/desktop\/assets\/icon\.(ico|png)$/)
  })

  it('points the Windows Start-menu shortcut at this Electron binary and whale icon', () => {
    const desktop = join(findRepoRoot(here), 'apps', 'desktop')
    const electronPath = join(desktop, 'node_modules', 'electron', 'dist', 'electron.exe')
    const spec = windowsShortcutSpec({ electronPath, desktopRoot: desktop })
    expect(spec.target).toBe(electronPath)
    expect(spec.args).toBe(JSON.stringify(desktop))
    expect(spec.cwd).toBe(desktop)
    expect(spec.appUserModelId).toBe('ai.deepseek.dsh.desktop')
    expect(spec.icon.replaceAll('\\', '/')).toMatch(/apps\/desktop\/assets\/icon\.ico$/)
    expect(windowsShortcutPath('C:\\Programs').replaceAll('\\', '/')).toBe('C:/Programs/DeepSeek Harness.lnk')
  })
})
