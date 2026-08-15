/**
 * Windows Start-menu shortcut that owns the DeepSeek whale icon.
 * Pinning that shortcut, not `electron.exe`, is what the taskbar keeps.
 * @module @deepseek-ai/dsh-desktop/shortcut
 */

import { join } from 'node:path'
import { APP_USER_MODEL_ID, WINDOWS_SHORTCUT_NAME, desktopIconPath } from './icon.ts'

/** Fields Electron writes into a `.lnk`. */
export interface DesktopShortcutSpec {
  target: string
  args: string
  cwd: string
  description: string
  icon: string
  iconIndex: number
  appUserModelId: string
}

/**
 * Absolute Start-menu path for this checkout's desktop shortcut.
 * @param programs - `%APPDATA%/Microsoft/Windows/Start Menu/Programs`.
 * @returns the `.lnk` path.
 */
export function windowsShortcutPath(programs: string): string {
  return join(programs, WINDOWS_SHORTCUT_NAME)
}

/**
 * Shortcut that launches this Electron binary with the desktop package as cwd.
 * @param options - resolved Electron binary and desktop package root.
 * @returns fields for `shell.writeShortcutLink`.
 */
export function windowsShortcutSpec(options: {
  electronPath: string
  desktopRoot: string
}): DesktopShortcutSpec {
  return {
    target: options.electronPath,
    args: JSON.stringify(options.desktopRoot),
    cwd: options.desktopRoot,
    description: 'DeepSeek Harness',
    // The shortcut only runs on Windows, so it takes the ICO even when
    // authored from a non-win32 development host.
    icon: desktopIconPath(join(options.desktopRoot, 'src'), 'win32'),
    iconIndex: 0,
    appUserModelId: APP_USER_MODEL_ID,
  }
}
