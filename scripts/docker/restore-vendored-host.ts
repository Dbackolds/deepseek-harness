/**
 * Copy vendored workspace packages that `pnpm deploy --legacy` omits from a
 * Host tree. The workspace overrides cosmokit/schemastery as `link:` paths,
 * and Cordis plugin peers such as group stay off the CLI production graph, so
 * a deployed `@deepseek-ai/dsh` cannot resolve them until they are restored.
 */

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isEntry } from '../release/process.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(scriptDir, '../..')

/** Directory names under `vendor/` that a packaged Host must be able to import. */
export const VENDORED_HOST_DIRECTORIES = [
  'cosmokit',
  'schemastery',
  'cordis',
  'group',
  'hmr',
  'include',
  'loader',
  'logger-console',
  'timer',
] as const

/**
 * Read the scoped package name from a vendored manifest.
 * @param vendorDir - absolute path of one `vendor/<name>` directory.
 * @returns the `@deepseek-ai/...` package name.
 */
export function vendoredPackageName(vendorDir: string): string {
  const parsed: unknown = JSON.parse(readFileSync(join(vendorDir, 'package.json'), 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`restore-vendored-host: ${vendorDir}/package.json is not a JSON object`)
  }
  const name = (parsed as { name?: unknown }).name
  if (typeof name !== 'string' || !name.startsWith('@deepseek-ai/')) {
    throw new Error(`restore-vendored-host: ${vendorDir} must declare a scoped @deepseek-ai name`)
  }
  return name
}

/**
 * Destination of one vendored package inside a deployed Host.
 * @param deployedRoot - `pnpm deploy` target that contains `node_modules`.
 * @param packageName - scoped package name.
 * @returns absolute path under `node_modules/@deepseek-ai`.
 */
export function deployedPackagePath(deployedRoot: string, packageName: string): string {
  const leaf = packageName.slice('@deepseek-ai/'.length)
  if (leaf === '' || leaf.includes('/') || leaf.includes('\\')) {
    throw new Error(`restore-vendored-host: unexpected package name ${packageName}`)
  }
  return join(deployedRoot, 'node_modules', '@deepseek-ai', leaf)
}

/**
 * Copy every required vendored package into a deployed Host when deploy omitted it.
 * Existing copies are left in place.
 * @param deployedRoot - `pnpm deploy` target.
 * @param repoRoot - repository root that contains `vendor/`.
 * @returns package names that were copied.
 */
export function restoreVendoredHostPackages(deployedRoot: string, repoRoot: string = defaultRoot): readonly string[] {
  const copied: string[] = []
  for (const directory of VENDORED_HOST_DIRECTORIES) {
    const vendorDir = join(repoRoot, 'vendor', directory)
    const packageName = vendoredPackageName(vendorDir)
    const destination = deployedPackagePath(deployedRoot, packageName)
    if (existsSync(destination)) continue
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(vendorDir, destination, {
      recursive: true,
      dereference: true,
      filter: (source) => {
        const relative = source.slice(vendorDir.length).replaceAll('\\', '/')
        if (relative === '/node_modules' || relative.startsWith('/node_modules/')) return false
        if (relative === '/tests' || relative.startsWith('/tests/')) return false
        return true
      },
    })
    copied.push(packageName)
  }
  const stillMissing = VENDORED_HOST_DIRECTORIES
    .map(directory => vendoredPackageName(join(repoRoot, 'vendor', directory)))
    .filter(name => !existsSync(deployedPackagePath(deployedRoot, name)))
  if (stillMissing.length > 0) {
    throw new Error(`restore-vendored-host: still missing ${stillMissing.join(', ')}`)
  }
  return copied
}

/** CLI entry: `pnpm exec tsx scripts/docker/restore-vendored-host.ts --deployed <dir>`. */
function main(): void {
  const { values } = parseArgs({
    options: {
      deployed: { type: 'string' },
      root: { type: 'string' },
    },
    allowPositionals: false,
  })
  if (values.deployed === undefined || values.deployed === '') {
    throw new Error('restore-vendored-host: --deployed is required')
  }
  const copied = restoreVendoredHostPackages(values.deployed, values.root ?? defaultRoot)
  if (copied.length === 0) {
    console.log('restore-vendored-host: vendored Host packages already present')
    return
  }
  console.log(`restore-vendored-host: copied ${copied.join(', ')}`)
}

if (isEntry(import.meta.url)) main()
