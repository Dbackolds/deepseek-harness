/** Desktop release tag, artifact names, and Host staging helpers. */

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  builderTarget,
  clampDesktopReleaseNotes,
  desktopReleaseNotes,
  desktopReleaseTag,
  desktopVersion,
  DESKTOP_RELEASE_NOTES_MAX_CHARS,
  expectedArtifacts,
  GITHUB_RELEASE_BODY_MAX_CHARS,
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

  it('summarizes commits since the previous desktop tag', () => {
    const notes = desktopReleaseNotes('0.1.0-rc.5.1', [
      'feat(web): 内置插件目录源与插件市场',
      '',
      '将 StarPivot catalog.json 作为 Host 具名路由随 web profile 交付。',
      '',
    ].join('\n'))
    expect(notes).toContain('Desktop archives for DeepSeek Harness 0.1.0-rc.5.1.')
    expect(notes).toContain('## Changes since the previous desktop release')
    expect(notes).toContain('feat(web): 内置插件目录源与插件市场')
    expect(notes).toContain('将 StarPivot catalog.json 作为 Host 具名路由随 web profile 交付。')
  })

  it('says so when the previous desktop tag has no later commits', () => {
    expect(desktopReleaseNotes('0.1.0-rc.5.1', '  \n')).toContain('No commits since the previous desktop tag.')
  })

  it('keeps GitHub Release notes under the API body cap', () => {
    const huge = desktopReleaseNotes('0.1.2-alpha.1', 'x'.repeat(DESKTOP_RELEASE_NOTES_MAX_CHARS + 50_000))
    expect(huge.length).toBeLessThanOrEqual(GITHUB_RELEASE_BODY_MAX_CHARS)
    expect(huge).toContain('truncated: GitHub release body is limited to 125000 characters.')
    expect(clampDesktopReleaseNotes('short').length).toBeLessThan(100)
  })
})

describe('desktop builder targets', () => {
  it('maps each platform to one electron-builder target', () => {
    expect(builderTarget('darwin')).toEqual({ flag: '--mac', target: 'zip' })
    expect(builderTarget('linux')).toEqual({ flag: '--linux', target: 'AppImage' })
    expect(builderTarget('win32')).toEqual({ flag: '--win', target: 'zip' })
  })

  it('names the artifacts the workflow uploads', () => {
    expect(expectedArtifacts('1.0.0', 'darwin')).toEqual(['DeepSeek Harness-1.0.0-mac.zip'])
    expect(expectedArtifacts('1.0.0', 'linux')).toEqual(['DeepSeek Harness-1.0.0.AppImage'])
    expect(expectedArtifacts('1.0.0', 'win32')).toEqual(['DeepSeek Harness-1.0.0-win.zip'])
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
