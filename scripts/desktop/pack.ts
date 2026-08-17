/**
 * Stage a packaged desktop Host and run electron-builder for one platform.
 * The window stays an Electron shell; the Host is a `pnpm deploy` of
 * `@deepseek-ai/dsh` plus a Node 24 binary copied from this runner
 * ([rationale](../../.agents/notes/implemented/process/2026-08-17-desktop-github-release.md)).
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { isEntry } from '../release/process.ts'

const root = resolve(import.meta.dirname, '../..')
const desktopRoot = join(root, 'apps', 'desktop')
const stagingRoot = join(root, 'dist-desktop', 'staging')
const appRoot = join(stagingRoot, 'app')
const hostRoot = join(stagingRoot, 'host')
const outDir = join(root, 'dist-desktop', 'release')

/** electron-builder pin used by both local and CI packaging. */
export const ELECTRON_BUILDER_SPEC = 'electron-builder@26.15.3'

/** Platforms this script can package. */
export const DESKTOP_PLATFORMS = ['darwin', 'linux', 'win32'] as const

/** One supported electron-builder target. */
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number]

/**
 * Read the desktop package version that names the GitHub Release tag.
 * @param manifestPath - desktop `package.json`.
 * @returns the version string.
 */
export function desktopVersion(manifestPath: string = join(desktopRoot, 'package.json')): string {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`desktop pack: ${manifestPath} is not a JSON object`)
  }
  const version = (parsed as { version?: unknown }).version
  if (typeof version !== 'string' || version === '') {
    throw new Error(`desktop pack: ${manifestPath} must declare a string version`)
  }
  return version
}

/**
 * Tag a desktop GitHub Release publishes from.
 * @param version - desktop package version.
 * @returns `desktop-v<version>`.
 */
export function desktopReleaseTag(version: string): string {
  return `desktop-v${version}`
}

/**
 * electron-builder target triple for one platform.
 * @param platform - Node platform of the runner that owns the Node binary.
 * @returns the `--mac` / `--linux` / `--win` argument plus its target.
 */
export function builderTarget(platform: DesktopPlatform): { flag: '--mac' | '--linux' | '--win'; target: string } {
  switch (platform) {
    case 'darwin':
      return { flag: '--mac', target: 'zip' }
    case 'linux':
      return { flag: '--linux', target: 'AppImage' }
    case 'win32':
      return { flag: '--win', target: 'zip' }
    default: {
      const exhaustive: never = platform
      throw new Error(`desktop pack: unsupported platform ${String(exhaustive)}`)
    }
  }
}

/**
 * Artifact names electron-builder writes for one version and platform.
 * @param version - desktop package version.
 * @param platform - packaged platform.
 * @returns expected filenames under `dist-desktop/release`.
 */
export function expectedArtifacts(version: string, platform: DesktopPlatform): readonly string[] {
  switch (platform) {
    case 'darwin':
      return [`DeepSeek Harness-${version}-mac.zip`]
    case 'linux':
      return [`DeepSeek Harness-${version}.AppImage`]
    case 'win32':
      return [`DeepSeek Harness-${version}-win.zip`]
    default: {
      const exhaustive: never = platform
      throw new Error(`desktop pack: unsupported platform ${String(exhaustive)}`)
    }
  }
}

/**
 * Assert the workflow runs from the desktop tag that names this version.
 * @param version - desktop package version.
 * @param ref - `GITHUB_REF`.
 */
export function verifyDesktopTag(version: string, ref: string): void {
  const expected = `refs/tags/${desktopReleaseTag(version)}`
  if (ref !== expected) {
    throw new Error(`desktop pack: publishing requires ${expected}, got ${ref || '(no ref)'}`)
  }
}

/**
 * Parse one platform name from `--platform`.
 * @param value - raw CLI value.
 * @returns the platform.
 */
export function parsePlatform(value: string | undefined): DesktopPlatform {
  if (value === undefined) {
    if (process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'win32') {
      return process.platform
    }
    throw new Error(`desktop pack: unsupported host platform ${process.platform}; pass --platform`)
  }
  if (value === 'darwin' || value === 'linux' || value === 'win32') return value
  throw new Error(`desktop pack: --platform must be one of ${DESKTOP_PLATFORMS.join(', ')}`)
}

/**
 * Run a command with inherited streams and fail on a non-zero exit.
 * @param command - executable.
 * @param args - arguments.
 * @param cwd - working directory.
 */
function run(command: string, args: readonly string[], cwd: string = root): void {
  const result = spawnSync(command, [...args], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
    shell: process.platform === 'win32',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`desktop pack: ${command} ${args.join(' ')} exited with ${String(result.status)}`)
}

/**
 * pnpm executable the packer can spawn.
 * Windows GitHub runners put `pnpm.cmd` on PATH; `spawnSync('pnpm')` without a
 * shell looks for `pnpm.exe` and fails with ENOENT.
 * @returns `pnpm.cmd` on Windows, otherwise `pnpm`.
 */
export function pnpmBin(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

/**
 * Copy this runner's Node binary into the staged Host.
 * @param destination - packaged Host root.
 */
function stageNodeBinary(destination: string): string {
  const name = process.platform === 'win32' ? 'node.exe' : 'node'
  const staged = join(destination, name)
  cpSync(process.execPath, staged)
  if (process.platform !== 'win32') chmodSync(staged, 0o755)
  return staged
}

/**
 * Deploy `@deepseek-ai/dsh` into `dist-desktop/staging/host/dsh` and copy Node.
 * @param skipBuild - skip `pnpm run build` when artifacts already exist.
 */
function stageHost(skipBuild = false): void {
  if (!skipBuild) run(pnpmBin(), ['run', 'build'])
  const bin = join(root, 'apps', 'cli', 'lib', 'bin.js')
  if (!existsSync(bin)) {
    throw new Error('desktop pack: apps/cli/lib/bin.js is missing; run without --skip-build')
  }
  rmSync(stagingRoot, { recursive: true, force: true })
  mkdirSync(hostRoot, { recursive: true })
  const deployed = join(hostRoot, 'dsh')
  run(pnpmBin(), [
    '--filter',
    '@deepseek-ai/dsh',
    'deploy',
    '--legacy',
    '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=true',
    '--config.link-workspace-packages=true',
    deployed,
  ])
  if (!existsSync(join(deployed, 'lib', 'bin.js'))) {
    throw new Error('desktop pack: pnpm deploy did not write apps/cli/lib/bin.js into the Host tree')
  }
  stageNodeBinary(hostRoot)
}

/**
 * Write the electron-builder config that consumes the staged Host.
 * @param version - desktop package version.
 * @param platform - packaged platform.
 * @returns the config path.
 */
function writeBuilderConfig(version: string, platform: DesktopPlatform): string {
  mkdirSync(stagingRoot, { recursive: true })
  const configPath = join(stagingRoot, 'electron-builder.json')
  const config = {
    appId: 'ai.deepseek.dsh.desktop',
    productName: 'DeepSeek Harness',
    copyright: 'Copyright © DeepSeek',
    directories: {
      app: appRoot,
      output: outDir,
    },
    extraMetadata: {
      name: 'dsh-desktop',
      version,
    },
    executableName: 'DeepSeekHarness',
    files: [
      'lib/**/*',
      'assets/**/*',
      'package.json',
    ],
    extraResources: [
      {
        from: hostRoot,
        to: 'host',
      },
    ],
    asar: true,
    artifactName: platform === 'darwin'
      ? 'DeepSeek Harness-${version}-mac.${ext}'
      : platform === 'win32'
        ? 'DeepSeek Harness-${version}-win.${ext}'
        : 'DeepSeek Harness-${version}.${ext}',
    mac: {
      category: 'public.app-category.developer-tools',
      icon: join(desktopRoot, 'assets', 'icon-512.png'),
      identity: null,
      target: ['zip'],
    },
    linux: {
      category: 'Development',
      executableName: 'DeepSeekHarness',
      icon: join(desktopRoot, 'assets', 'icon-512.png'),
      target: ['AppImage'],
    },
    win: {
      icon: join(desktopRoot, 'assets', 'icon.ico'),
      target: ['zip'],
    },
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  return configPath
}

/**
 * Copy the compiled desktop shell into a leaf app directory electron-builder
 * can treat as the application root without walking the workspace.
 */
function stageApp(): void {
  run(pnpmBin(), ['--filter', '@deepseek-ai/dsh-desktop', 'run', 'build'])
  const compiled = join(desktopRoot, 'lib', 'main.js')
  if (!existsSync(compiled)) {
    throw new Error('desktop pack: apps/desktop/lib/main.js is missing after the desktop build')
  }
  rmSync(appRoot, { recursive: true, force: true })
  mkdirSync(appRoot, { recursive: true })
  for (const name of ['lib', 'assets', 'package.json'] as const) {
    cpSync(join(desktopRoot, name), join(appRoot, name), { recursive: true })
  }
}

/**
 * Package the staged Host with electron-builder.
 * @param platform - packaged platform.
 * @param skipBuild - skip the repository build before staging.
 */
function packDesktop(platform: DesktopPlatform, skipBuild = false): void {
  const version = desktopVersion()
  stageHost(skipBuild)
  stageApp()
  const configPath = writeBuilderConfig(version, platform)
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  const target = builderTarget(platform)
  run(pnpmBin(), [
    'dlx',
    ELECTRON_BUILDER_SPEC,
    '--config',
    configPath,
    '--publish',
    'never',
    target.flag,
    target.target,
  ], desktopRoot)
  for (const name of expectedArtifacts(version, platform)) {
    const path = join(outDir, name)
    if (!existsSync(path)) throw new Error(`desktop pack: missing artifact ${path}`)
  }
}

/** CLI entry: `pnpm exec tsx scripts/desktop/pack.ts [--platform <p>] [--skip-build]`. */
function main(): void {
  const { values } = parseArgs({
    options: {
      platform: { type: 'string' },
      'skip-build': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })
  packDesktop(parsePlatform(values.platform), values['skip-build'] === true)
}

if (isEntry(import.meta.url)) main()
