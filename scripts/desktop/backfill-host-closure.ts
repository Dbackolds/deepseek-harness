/**
 * Copy workspace packages a packaged Host references but `pnpm deploy --legacy`
 * omits. Deploy prunes the Host tree to the CLI's npm dependency graph, while
 * the running Host resolves more than that: Service Definitions and providers
 * that appear only as peerDependencies of deployed packages, composition rows
 * inside bundle `cordis.patch.yml` files, and `dsh.client.inject` lists.
 * A missing reference fails plugin boot or lazy composition wholesale, so the
 * packer backfills the closure from the built workspace instead.
 *
 * @module scripts/desktop/backfill-host-closure
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { loadCordisYaml } from '../cordis-yaml.ts'
import { isEntry } from '../release/process.ts'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(scriptDir, '../..')

/** Directory entries a backfilled copy never carries; deploy output carries none of them. */
const COPY_EXCLUDE = [/^node_modules$/u, /^tests$/u, /^src$/u, /^tsconfig(\..*)?\.json$/u, /^tsdown\.config\.ts$/u, /\.tsbuildinfo$/u]

/** Composition files whose plugin rows name Host packages by npm id. */
const COMPOSITION_FILENAMES = new Set(['cordis.patch.yml', 'agent.cordis.yml'])

/**
 * Index every workspace package by npm name.
 * @param repoRoot - repository root containing `packages/<group>/<pkg>`.
 * @returns package name to package directory; first registration wins.
 */
export function workspacePackageIndex(repoRoot: string = defaultRoot): Map<string, string> {
  const index = new Map<string, string>()
  const groupsDir = join(repoRoot, 'packages')
  if (!existsSync(groupsDir)) return index
  for (const group of readdirSync(groupsDir)) {
    const groupDir = join(groupsDir, group)
    if (!statSync(groupDir).isDirectory()) continue
    for (const pkg of readdirSync(groupDir)) {
      const manifest = join(groupDir, pkg, 'package.json')
      if (!existsSync(manifest)) continue
      try {
        const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf8'))
        const name = (parsed as { name?: unknown }).name
        if (typeof name === 'string' && name.startsWith('@deepseek-ai/') && !index.has(name)) {
          index.set(name, join(groupDir, pkg))
        }
      } catch {
        // An unparsable manifest is not a workspace package this backfill can supply.
      }
    }
  }
  return index
}

/**
 * Reduce a plugin specifier to its npm package name.
 * @param specifier - a Loader row `name` value, possibly with a subpath or a bare id.
 * @returns `@scope/name` or the leading path-free segment; paths and URLs stay as-is.
 */
export function packageNameFromSpecifier(specifier: string): string {
  if (specifier.startsWith('/') || specifier.startsWith('.') || /^[a-z]+:\/\//u.test(specifier)) return specifier
  const segments = specifier.split('/')
  const first = segments[0]
  if (first === undefined) return specifier
  return first.startsWith('@') ? [first, segments[1] ?? ''].filter(part => part !== '').join('/') : first
}

/**
 * Collect plugin names from one parsed composition document.
 * @param value - a `loadCordisYaml` result of any shape.
 * @param names - collected normalized package names.
 */
function collectCompositionNames(value: unknown, names: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCompositionNames(item, names)
    return
  }
  if (typeof value !== 'object' || value === null) return
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'name' && typeof entry === 'string') names.add(packageNameFromSpecifier(entry))
    collectCompositionNames(entry, names)
  }
}

/**
 * Find every composition file under one package directory, excluding nested
 * `node_modules` trees.
 * @param packageDir - deployed package root.
 * @returns absolute composition file paths.
 */
function compositionFiles(packageDir: string): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (COMPOSITION_FILENAMES.has(entry.name)) found.push(path)
    }
  }
  walk(packageDir)
  return found
}

/**
 * Every package name the deployed Host tree references but does not carry.
 * References are the deployed packages' own `dependencies` and
 * `peerDependencies`, their `dsh.client.inject` lists, and plugin rows of
 * every composition file under a deployed `@deepseek-ai` package.
 * @param deployedRoot - `pnpm deploy` target containing `node_modules`.
 * @returns names missing from the deployed `node_modules/@deepseek-ai` scope.
 */
export function missingHostReferences(deployedRoot: string): Set<string> {
  const scoped = join(deployedRoot, 'node_modules', '@deepseek-ai')
  const referenced = new Set<string>()
  const deployedManifests: { manifest: Record<string, unknown>; packageDir?: string }[] = []
  const rootManifest = join(deployedRoot, 'package.json')
  if (existsSync(rootManifest)) {
    deployedManifests.push({ manifest: JSON.parse(readFileSync(rootManifest, 'utf8')) as Record<string, unknown> })
  }
  if (existsSync(scoped)) {
    for (const leaf of readdirSync(scoped)) {
      const packageDir = join(scoped, leaf)
      const manifest = join(packageDir, 'package.json')
      if (!existsSync(manifest)) continue
      deployedManifests.push({
        manifest: JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>,
        packageDir,
      })
    }
  }
  const carried = new Set<string>()
  for (const { manifest, packageDir } of deployedManifests) {
    for (const field of ['dependencies', 'peerDependencies'] as const) {
      const section = manifest[field]
      if (typeof section === 'object' && section !== null) {
        for (const name of Object.keys(section as Record<string, unknown>)) referenced.add(packageNameFromSpecifier(name))
      }
    }
    const dsh = manifest.dsh as { client?: { inject?: unknown } } | undefined
    const inject = dsh?.client?.inject
    if (Array.isArray(inject)) {
      for (const name of inject) if (typeof name === 'string') referenced.add(packageNameFromSpecifier(name))
    }
    if (packageDir !== undefined) {
      for (const file of compositionFiles(packageDir)) {
        collectCompositionNames(loadCordisYaml(readFileSync(file, 'utf8')), referenced)
      }
    }
    if (typeof manifest.name === 'string') carried.add(manifest.name)
  }
  const missing = new Set<string>()
  for (const name of referenced) {
    if (name.startsWith('@deepseek-ai/') && !carried.has(name)) missing.add(name)
  }
  return missing
}

/**
 * Copy one workspace package into the deployed Host's scoped node_modules.
 * @param repoDir - workspace package directory with built `lib/`.
 * @param destination - deployed copy path.
 */
function copyWorkspacePackage(repoDir: string, destination: string): void {
  if (!existsSync(join(repoDir, 'lib'))) {
    throw new Error(`backfill-host-closure: ${repoDir} has no built lib/; run pnpm run build from the repository root`)
  }
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(repoDir, destination, {
    recursive: true,
    dereference: true,
    filter: (source) => {
      const relative = source.slice(repoDir.length).replaceAll('\\', '/')
      if (relative === '') return true
      const leaf = relative.slice(1).split('/')[0] ?? ''
      return !COPY_EXCLUDE.some(pattern => pattern.test(leaf))
    },
  })
}

/**
 * Backfill every workspace package the deployed Host references until the
 * reference set stops growing: a copied package can itself reference another
 * omitted one, so passes repeat until a pass copies nothing.
 * @param deployedRoot - `pnpm deploy` target containing `node_modules`.
 * @param repoRoot - repository root containing `packages/`.
 * @returns package names that were copied, in copy order.
 */
export function backfillWorkspaceHostClosure(deployedRoot: string, repoRoot: string = defaultRoot): string[] {
  const index = workspacePackageIndex(repoRoot)
  const copied: string[] = []
  for (;;) {
    const missing = [...missingHostReferences(deployedRoot)].filter(name => index.has(name))
    if (missing.length === 0) break
    for (const name of missing) {
      const repoDir = index.get(name)
      if (repoDir === undefined) continue
      copyWorkspacePackage(repoDir, join(deployedRoot, 'node_modules', '@deepseek-ai', name.slice('@deepseek-ai/'.length)))
      copied.push(name)
    }
  }
  return copied
}

/** CLI entry: `pnpm exec tsx scripts/desktop/backfill-host-closure.ts --deployed <dir>`. */
function main(): void {
  const { values } = parseArgs({
    options: {
      deployed: { type: 'string' },
      root: { type: 'string' },
    },
    allowPositionals: false,
  })
  if (values.deployed === undefined || values.deployed === '') {
    throw new Error('backfill-host-closure: --deployed is required')
  }
  const copied = backfillWorkspaceHostClosure(values.deployed, values.root ?? defaultRoot)
  if (copied.length === 0) {
    console.log('backfill-host-closure: Host workspace closure already complete')
    return
  }
  console.log(`backfill-host-closure: copied ${copied.join(', ')}`)
}

if (isEntry(import.meta.url)) main()
