/**
 * Verify that every client plugin declares the Remote namespaces it reads.
 * The gateway client installs each `remote.<namespace>` as a traced service,
 * so a `ctx.remote.<namespace>` read resolves only when the plugin's `inject`
 * declares `remote.<namespace>`. A missing declaration passes typecheck and
 * fails at runtime with `cannot get property "remote.<namespace>" without
 * inject` — exactly the failure mode that shipped in desktop 0.1.2-alpha.1.1.
 *
 * Two declaration patterns are checked, both rooted at the unaliased
 * `ctx.remote` receiver so namespace handles bound to other variable names
 * (`this.remote` on a typed handle interface) stay out of scope:
 * 1. direct chained reads `ctx.remote.<namespace>`;
 * 2. a client source file that passes `ctx.remote` into a constructor or
 *    factory and elsewhere reads `this.api.<namespace>` — the established
 *    store convention for a `ClientRemote` constructor parameter.
 *
 * @module scripts/verify-client-remote-inject
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isEntry } from './release/process.ts'

const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)))
const defaultRoot = resolve(scriptDir, '..')

const CLIENT_ROOT = join('packages', 'client')
const NON_NAMESPACE_REMOTE_MEMBERS = new Set(['$on', '$stream', '$mount', '$off'])

/** One declared-but-unread or read-but-undeclared Remote namespace finding. */
export interface RemoteInjectFinding {
  readonly packageName: string
  readonly file: string
  readonly namespace: string
}

/** Fully-qualified declaration and read sets for one client package. */
export interface RemoteInjectScan {
  readonly packageName: string
  readonly declared: ReadonlySet<string>
  readonly read: ReadonlySet<string>
  readonly findings: readonly RemoteInjectFinding[]
}

/**
 * List client source files of one package, recursively.
 * @param packageDir - absolute `packages/client/<name>` directory.
 * @returns absolute `.ts` / `.tsx` file paths under `src/client`.
 */
function clientSourceFiles(packageDir: string): string[] {
  const root = join(packageDir, 'src', 'client')
  const files: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path)
    }
  }
  walk(root)
  return files
}

/**
 * Scan one client package for Remote namespace reads that its `inject` does
 * not declare.
 * @param packageDir - absolute `packages/client/<name>` directory.
 * @returns the scan result; `findings` is empty when the package conforms.
 */
export function scanClientRemoteInject(packageDir: string): RemoteInjectScan {
  const packageName = basenameOf(packageDir)
  const declared = new Set<string>()
  const read = new Set<string>()
  let passesRemoteValue = false
  for (const file of clientSourceFiles(packageDir)) {
    const source = readIfExists(file)
    if (source === undefined) continue
    const injectMatch = /\bexport const inject = \[([^\]]*)\]/u.exec(source)
    if (injectMatch !== null && injectMatch[1] !== undefined) {
      for (const match of injectMatch[1].matchAll(/'remote\.([a-zA-Z][\w.]*)'/gu)) {
        if (match[1] !== undefined) declared.add(match[1])
      }
    }
    if (/\bctx\.remote\b/.test(source) && /\(\s*ctx\.remote\b|\[\s*ctx\.remote\b|=\s*ctx\.remote\b/u.test(source)) {
      passesRemoteValue = true
    }
    for (const match of source.matchAll(/\bctx\.remote\.([a-zA-Z][\w]*)/gu)) {
      if (match[1] !== undefined && !NON_NAMESPACE_REMOTE_MEMBERS.has(match[1])) read.add(match[1])
    }
    if (passesRemoteValue) {
      for (const match of source.matchAll(/\bthis\.api\.([a-zA-Z][\w]*)/gu)) {
        if (match[1] !== undefined) read.add(match[1])
      }
    }
  }
  const findings = [...read]
    .filter(namespace => !declared.has(namespace))
    .sort()
    .map(namespace => ({ packageName, file: join(packageDir, 'src', 'client'), namespace }))
  return { packageName, declared, read, findings }
}

/**
 * Scan every client package under the repository root.
 * @param repoRoot - repository root containing `packages/client`.
 * @returns findings per nonconforming package; empty when all conform.
 */
export function verifyClientRemoteInject(repoRoot: string = defaultRoot): readonly RemoteInjectFinding[] {
  const clientsDir = join(repoRoot, CLIENT_ROOT)
  const findings: RemoteInjectFinding[] = []
  for (const entry of readdirSync(clientsDir)) {
    const packageDir = join(clientsDir, entry)
    if (!statSync(packageDir).isDirectory()) continue
    if (!existsIgnoreCase(packageDir, 'src', 'client')) continue
    findings.push(...scanClientRemoteInject(packageDir).findings)
  }
  return findings
}

function existsIgnoreCase(...segments: string[]): boolean {
  try {
    statSync(join(...segments))
    return true
  } catch {
    return false
  }
}

function basenameOf(dir: string): string {
  const parts = dir.replaceAll('\\', '/').split('/')
  return parts[parts.length - 1] ?? dir
}

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function renderFindings(findings: readonly RemoteInjectFinding[]): string {
  return findings
    .map(finding => `${finding.packageName}: reads remote.${finding.namespace} without declaring 'remote.${finding.namespace}' in inject`)
    .join('\n')
}

/** CLI entry: `pnpm exec tsx scripts/verify-client-remote-inject.ts`. */
function main(): void {
  parseArgs({ options: {}, allowPositionals: false })
  const findings = verifyClientRemoteInject()
  if (findings.length > 0) {
    throw new Error(`verify-client-remote-inject: undeclared Remote namespace reads:\n${renderFindings(findings)}`)
  }
  console.log('verify-client-remote-inject: every client panel declares the Remote namespaces it reads')
}

if (isEntry(import.meta.url)) main()
