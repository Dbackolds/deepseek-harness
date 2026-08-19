import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { bounceDockForCompleted } from '../src/dock-attention.ts'

const here = dirname(fileURLToPath(import.meta.url))
const preload = readFileSync(join(here, '../src/preload.ts'), 'utf8')
const main = readFileSync(join(here, '../src/main.ts'), 'utf8')

describe('bounceDockForCompleted', () => {
  it('bounces informational once when a dock is present', () => {
    const bounce = vi.fn(() => 1)
    bounceDockForCompleted({ bounce })
    expect(bounce).toHaveBeenCalledWith('informational')
  })

  it('is a no-op without a dock', () => {
    expect(() => { bounceDockForCompleted(undefined) }).not.toThrow()
  })
})

describe('desktop completed attention wiring', () => {
  it('exposes notifyCompleted from the isolated preload', () => {
    expect(preload).toContain("notifyCompleted: () => { ipcRenderer.send('dsh-desktop:notify-completed') }")
  })

  it('routes the completed IPC to the dock bounce on macOS', () => {
    expect(main).toContain("ipcMain.on('dsh-desktop:notify-completed'")
    expect(main).toContain('bounceDockForCompleted(IS_MAC ? app.dock : undefined)')
    expect(main).toContain('requestSingleInstanceLock()')
  })
})
