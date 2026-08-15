/**
 * DeepSeek whale mark used by the desktop window and Windows shortcuts.
 * @module @deepseek-ai/dsh-desktop/icon
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Windows AppUserModelID shared by the window and the Start-menu shortcut. */
export const APP_USER_MODEL_ID = 'ai.deepseek.dsh.desktop'

/** Start-menu shortcut file name so a pin keeps this AppUserModelID. */
export const WINDOWS_SHORTCUT_NAME = 'DeepSeek Harness.lnk'

/**
 * Packaged DeepSeek whale mark next to this package's compiled main.
 * @param from - directory of the compiled or source module.
 * @returns absolute path of the Windows ICO, or the PNG fallback.
 */
export function desktopIconPath(from: string = fileURLToPath(new URL('.', import.meta.url))): string {
  const assets = join(from, '..', 'assets')
  const ico = join(assets, 'icon.ico')
  if (process.platform === 'win32' && existsSync(ico)) return ico
  return join(assets, 'icon.png')
}
