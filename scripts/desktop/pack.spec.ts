/** Desktop release tag, artifact names, and Host staging helpers. */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  builderTarget,
  desktopReleaseTag,
  desktopVersion,
  expectedArtifacts,
  parsePlatform,
  pnpmBin,
  verifyDesktopTag,
} from './pack.ts'

describe('desktop release naming', () => {
  it('names the GitHub Release tag from the desktop package version', () => {
    expect(desktopReleaseTag('0.1.0-rc.5')).toBe('desktop-v0.1.0-rc.5')
    expect(desktopVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('reads the version from a desktop-shaped manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-manifest-'))
    const manifest = join(dir, 'package.json')
    writeFileSync(manifest, `${JSON.stringify({ name: '@deepseek-ai/dsh-desktop', version: '1.2.3' })}\n`)
    expect(desktopVersion(manifest)).toBe('1.2.3')
  })

  it('rejects a missing or empty version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-desktop-bad-manifest-'))
    const manifest = join(dir, 'package.json')
    writeFileSync(manifest, '{}\n')
    expect(() => desktopVersion(manifest)).toThrow(/must declare a string version/)
  })

  it('accepts only the matching desktop-v tag when publishing', () => {
    verifyDesktopTag('0.1.0-rc.5', 'refs/tags/desktop-v0.1.0-rc.5')
    expect(() => verifyDesktopTag('0.1.0-rc.5', 'refs/heads/master')).toThrow(/publishing requires/)
    expect(() => verifyDesktopTag('0.1.0-rc.5', 'refs/tags/dsh-v0.1.0-rc.5')).toThrow(/desktop-v0\.1\.0-rc\.5/)
  })
})

describe('desktop builder targets', () => {
  it('maps each platform to one electron-builder target', () => {
    expect(builderTarget('darwin')).toEqual({ flag: '--mac', target: 'zip' })
    expect(builderTarget('linux')).toEqual({ flag: '--linux', target: 'AppImage' })
    expect(builderTarget('win32')).toEqual({ flag: '--win', target: 'nsis' })
  })

  it('names the artifacts the workflow uploads', () => {
    expect(expectedArtifacts('1.0.0', 'darwin')).toEqual(['DeepSeek Harness-1.0.0-mac.zip'])
    expect(expectedArtifacts('1.0.0', 'linux')).toEqual(['DeepSeek Harness-1.0.0.AppImage'])
    expect(expectedArtifacts('1.0.0', 'win32')).toEqual(['DeepSeek Harness Setup 1.0.0.exe'])
  })

  it('defaults --platform to the host and rejects an unknown name', () => {
    expect(parsePlatform(undefined)).toBe(process.platform)
    expect(parsePlatform('linux')).toBe('linux')
    expect(() => parsePlatform('android')).toThrow(/--platform must be one of/)
  })

  it('spawns pnpm.cmd on Windows so pack does not look for pnpm.exe', () => {
    expect(pnpmBin()).toBe(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
  })
})
