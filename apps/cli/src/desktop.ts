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
 * Start Electron for `@deepseek-ai/dsh-desktop` and wait until it exits.
 * @param args - extra arguments forwarded to the wrapped `dsh web` Host.
 * @returns Electron's process exit code.
 */
export async function runDesktop(args: readonly string[]): Promise<number> {
  const root = desktopRoot()
  const electronBin = join(root, 'node_modules', 'electron', 'cli.js')
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
  const result = spawnSync(process.execPath, [electronBin, root], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DSH_DESKTOP_WEB_ARGS: JSON.stringify(args),
    },
    windowsHide: false,
  })
  if (result.error !== undefined) {
    console.error(`dsh desktop: ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}
