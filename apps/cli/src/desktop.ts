/**
 * Launch the Electron window around the local web Host.
 * @module @deepseek-ai/dsh/desktop
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Resolve the desktop package from this CLI checkout.
 * Source (`src/desktop.ts`) and the bundled bin (`lib/bin.js`) both sit one
 * directory under `apps/cli`.
 * @returns absolute path of `apps/desktop`.
 */
export function desktopRoot(): string {
  return join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'desktop')
}

/**
 * Electron binary used as the Windows process image.
 * @param root - `apps/desktop`.
 * @returns `electron.exe` on Windows, otherwise the JS CLI.
 */
export function electronLaunchPath(root: string): string {
  const exe = join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
  if (process.platform === 'win32' && existsSync(exe)) return exe
  return join(root, 'node_modules', 'electron', 'cli.js')
}

/**
 * Start Electron for `@deepseek-ai/dsh-desktop` and wait until it exits.
 * @param args - extra arguments forwarded to the wrapped `dsh web` Host.
 * @returns Electron's process exit code.
 */
export async function runDesktop(args: readonly string[]): Promise<number> {
  const root = desktopRoot()
  const electronBin = electronLaunchPath(root)
  if (!existsSync(electronBin)) {
    console.error('dsh desktop: Electron is not installed; run pnpm install from the repository root')
    return 1
  }
  const compiledMain = join(root, 'lib', 'main.js')
  if (!existsSync(compiledMain)) {
    const tsc = spawnSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(root, 'tsconfig.json')], {
      cwd: root,
      stdio: 'inherit',
    })
    if (tsc.status !== 0) return tsc.status ?? 1
  }
  const argv = process.platform === 'win32' ? [root] : [electronBin, root]
  const command = process.platform === 'win32' ? electronBin : process.execPath
  const result = spawnSync(command, argv, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DSH_DESKTOP_WEB_ARGS: JSON.stringify(args),
      DSH_NODE_EXEC: process.execPath,
    },
    windowsHide: false,
  })
  if (result.error !== undefined) {
    console.error(`dsh desktop: ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}
