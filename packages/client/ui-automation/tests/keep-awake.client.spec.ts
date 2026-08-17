/** KeepAwakeHold: spawn helpers, Windows path, and dispose. */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeepAwakeHold, internals, preventWindowsSleep } from '../src/keep-awake.ts'

class FakeChild extends EventEmitter {
  killed = false
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  kill(): boolean {
    this.killed = true
    this.exitCode = 0
    this.emit('exit', 0, null)
    return true
  }
}

afterEach(async () => {
  const child = await import('node:child_process')
  const { promisify } = await import('node:util')
  internals.spawn = child.spawn
  internals.execFile = promisify(child.execFile)
  internals.preventWindowsSleep = preventWindowsSleep
})

describe('KeepAwakeHold', () => {
  it('spawns a helper once and kills it on dispose', async () => {
    const child = new FakeChild()
    const spawn = vi.fn(() => child)
    internals.spawn = spawn as unknown as typeof internals.spawn
    const hold = new KeepAwakeHold()
    await hold.setEnabled(true)
    await hold.setEnabled(true)
    expect(spawn).toHaveBeenCalledTimes(1)
    hold.dispose()
    expect(child.killed).toBe(true)
    await hold.setEnabled(false)
  })

  it('treats a spawn throw or later error as no assertion', async () => {
    internals.spawn = (() => { throw new Error('missing') }) as unknown as typeof internals.spawn
    const hold = new KeepAwakeHold()
    await hold.setEnabled(true)
    hold.dispose()
    const child = new FakeChild()
    internals.spawn = vi.fn(() => child) as unknown as typeof internals.spawn
    const retry = new KeepAwakeHold()
    await retry.setEnabled(true)
    child.emit('error', new Error('gone'))
    await retry.setEnabled(true)
    expect(internals.spawn).toHaveBeenCalledTimes(2)
    retry.dispose()
  })

  it('records a Windows assertion without spawning a child', async () => {
    internals.preventWindowsSleep = vi.fn(async () => true)
    const original = process.platform
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    try {
      const hold = new KeepAwakeHold()
      await hold.setEnabled(true)
      expect(internals.preventWindowsSleep).toHaveBeenCalledTimes(1)
      hold.dispose()
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: original })
    }
  })

  it('treats a failed Windows power call as no assertion', async () => {
    internals.preventWindowsSleep = vi.fn(async () => false)
    const original = process.platform
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' })
    try {
      const hold = new KeepAwakeHold()
      await hold.setEnabled(true)
      hold.dispose()
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: original })
    }
  })

  it('does nothing on an unsupported platform', async () => {
    const spawn = vi.fn()
    internals.spawn = spawn as unknown as typeof internals.spawn
    internals.preventWindowsSleep = vi.fn(async () => true)
    const original = process.platform
    Object.defineProperty(process, 'platform', { configurable: true, value: 'freebsd' })
    try {
      const hold = new KeepAwakeHold()
      await hold.setEnabled(true)
      expect(spawn).not.toHaveBeenCalled()
      expect(internals.preventWindowsSleep).not.toHaveBeenCalled()
      hold.dispose()
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: original })
    }
  })

  it('uses systemd-inhibit on Linux', async () => {
    const child = new FakeChild()
    const spawn = vi.fn(() => child)
    internals.spawn = spawn as unknown as typeof internals.spawn
    const original = process.platform
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
    try {
      const hold = new KeepAwakeHold()
      await hold.setEnabled(true)
      expect(spawn).toHaveBeenCalledWith('systemd-inhibit', expect.arrayContaining(['--what=idle']), expect.anything())
      child.exitCode = 0
      child.emit('exit', 0, null)
      hold.dispose()
    } finally {
      Object.defineProperty(process, 'platform', { configurable: true, value: original })
    }
  })
})

describe('preventWindowsSleep', () => {
  it('returns true when the helper succeeds and false when it rejects', async () => {
    internals.execFile = vi.fn(async () => ({ stdout: '', stderr: '' })) as unknown as typeof internals.execFile
    expect(await preventWindowsSleep()).toBe(true)
    internals.execFile = vi.fn(async () => { throw new Error('no powershell') }) as unknown as typeof internals.execFile
    expect(await preventWindowsSleep()).toBe(false)
  })
})
