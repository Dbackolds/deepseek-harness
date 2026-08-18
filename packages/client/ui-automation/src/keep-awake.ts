/**
 * Process-local OS sleep assertion for a live Automation Host.
 * macOS uses `caffeinate -i`; Windows uses `SetThreadExecutionState`;
 * Linux uses `systemd-inhibit --what=idle`. Absence of the helper is a
 * no-op: the Host still fires while it is running, and the OS may still sleep.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Controllable spawn and Windows helper for tests. */
export const internals: {
  spawn: typeof spawn
  execFile: typeof execFileAsync
  preventWindowsSleep: typeof preventWindowsSleep
} = {
  spawn,
  execFile: execFileAsync,
  preventWindowsSleep,
}

/**
 * Ask Windows not to idle-sleep this process.
 * @returns whether the power call succeeded.
 */
export async function preventWindowsSleep(): Promise<boolean> {
  try {
    await internals.execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -Namespace Dsh -Name KeepAwake -MemberDefinition \'[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);\'; [void][Dsh.KeepAwake]::SetThreadExecutionState(0x80000001)',
    ])
    return true
  } catch {
    return false
  }
}

/** One held OS sleep assertion, or none. */
export class KeepAwakeHold {
  private child: ChildProcess | undefined
  private windowsHeld = false

  /**
   * Apply or release the assertion to match the durable preference.
   * @param enabled - whether the Host should hold an assertion.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.acquire()
      return
    }
    this.release()
  }

  /** Drop any held assertion. Safe to call when none is held. */
  dispose(): void {
    this.release()
  }

  private async acquire(): Promise<void> {
    if (this.child !== undefined || this.windowsHeld) return
    if (process.platform === 'darwin') {
      this.child = this.spawnHelper('caffeinate', ['-i'])
      return
    }
    if (process.platform === 'linux') {
      this.child = this.spawnHelper('systemd-inhibit', [
        '--what=idle',
        '--who=DeepSeek Harness',
        '--why=Host Automation keep-awake',
        '--mode=block',
        'sleep',
        'infinity',
      ])
      return
    }
    if (process.platform === 'win32') {
      this.windowsHeld = await internals.preventWindowsSleep()
      return
    }
  }

  private spawnHelper(command: string, args: readonly string[]): ChildProcess | undefined {
    try {
      const child = internals.spawn(command, [...args], {
        stdio: 'ignore',
        windowsHide: true,
      })
      child.on('error', () => { this.forget(child) })
      child.on('exit', () => { this.forget(child) })
      return child
    } catch {
      return undefined
    }
  }

  private forget(child: ChildProcess): void {
    if (this.child === child) this.child = undefined
  }

  private release(): void {
    const child = this.child
    this.child = undefined
    this.windowsHeld = false
    if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
    child.kill()
  }
}
