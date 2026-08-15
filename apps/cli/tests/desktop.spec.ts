import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { desktopRoot, electronLaunchPath } from '../src/desktop.ts'

describe('desktopRoot', () => {
  it('resolves the sibling desktop app from this CLI checkout', () => {
    const root = desktopRoot()
    expect(existsSync(root)).toBe(true)
    expect(root.replaceAll('\\', '/')).toMatch(/apps\/desktop$/)
    expect(existsSync(electronLaunchPath(root))).toBe(true)
  })
})
