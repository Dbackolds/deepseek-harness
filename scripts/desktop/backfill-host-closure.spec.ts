/** Workspace-closure backfill for a deployed desktop Host tree. */

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  backfillWorkspaceHostClosure,
  missingHostReferences,
  packageNameFromSpecifier,
  workspacePackageIndex,
} from './backfill-host-closure.ts'

const root = join(import.meta.dirname, '../..')

function writePackage(dir: string, manifest: Record<string, unknown>): void {
  mkdirSync(join(dir, 'lib'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest)}\n`)
  writeFileSync(join(dir, 'lib', 'index.js'), 'export {}\n')
}

function makeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'dsh-backfill-repo-'))
  // `one` is already deployed; `two` is its omitted peer and itself peers `four`.
  writePackage(join(repo, 'packages', 'group', 'one'), { name: '@deepseek-ai/one' })
  writePackage(join(repo, 'packages', 'group', 'two'), {
    name: '@deepseek-ai/two',
    peerDependencies: { '@deepseek-ai/four': 'workspace:^' },
  })
  writePackage(join(repo, 'packages', 'group', 'four'), { name: '@deepseek-ai/four' })
  // `three` is named only by a bundle composition row, carries a preset
  // directory, and keeps src/ that a deployed copy never ships.
  const three = join(repo, 'packages', 'group', 'three')
  writePackage(three, { name: '@deepseek-ai/three' })
  mkdirSync(join(three, 'presets', 'ptc'), { recursive: true })
  writeFileSync(join(three, 'presets', 'ptc', 'agent.cordis.yml'), '- id: ptc\n  name: four\n')
  mkdirSync(join(three, 'src'))
  writeFileSync(join(three, 'src', 'index.ts'), 'export {}\n')
  return repo
}

function makeDeployed(): string {
  const deployed = mkdtempSync(join(tmpdir(), 'dsh-backfill-deployed-'))
  writePackage(join(deployed, 'node_modules', '@deepseek-ai', 'one'), {
    name: '@deepseek-ai/one',
    peerDependencies: { '@deepseek-ai/two': 'workspace:^' },
  })
  const bundle = join(deployed, 'node_modules', '@deepseek-ai', 'bundle')
  writePackage(bundle, { name: '@deepseek-ai/bundle' })
  writeFileSync(
    join(bundle, 'cordis.patch.yml'),
    '- id: three\n  name: "@deepseek-ai/three"\n  config:\n    flag: !!js "1 + 1"\n- id: sub\n  name: "@deepseek-ai/two/list-agents"\n',
  )
  return deployed
}

describe('backfillWorkspaceHostClosure', () => {
  it('indexes workspace packages by npm name', () => {
    const index = workspacePackageIndex(root)
    expect(index.get('@deepseek-ai/dsh-jobs')).toBe(join(root, 'packages', 'jobs', 'jobs'))
    expect(index.has('@deepseek-ai/dsh-llm-default-policy')).toBe(true)
  })

  it('reduces plugin specifiers to package names', () => {
    expect(packageNameFromSpecifier('@deepseek-ai/dsh-tool-subagent-control/list-agents'))
      .toBe('@deepseek-ai/dsh-tool-subagent-control')
    expect(packageNameFromSpecifier('js-yaml')).toBe('js-yaml')
    expect(packageNameFromSpecifier('/abs/plugin.js')).toBe('/abs/plugin.js')
  })

  it('reports peer, composition, and subpath references the tree does not carry', () => {
    const missing = missingHostReferences(makeDeployed())
    expect([...missing].sort()).toEqual(['@deepseek-ai/three', '@deepseek-ai/two'])
  })

  it('backfills the transitive closure and ships only deploy-shaped directories', () => {
    const repo = makeRepo()
    const deployed = makeDeployed()
    const copied = backfillWorkspaceHostClosure(deployed, repo)
    expect([...copied].sort()).toEqual(['@deepseek-ai/four', '@deepseek-ai/three', '@deepseek-ai/two'])
    for (const name of ['two', 'four', 'three']) {
      expect(existsSync(join(deployed, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js'))).toBe(true)
    }
    const three = join(deployed, 'node_modules', '@deepseek-ai', 'three')
    expect(existsSync(join(three, 'presets', 'ptc', 'agent.cordis.yml'))).toBe(true)
    expect(existsSync(join(three, 'src'))).toBe(false)
    expect(missingHostReferences(deployed).size).toBe(0)
  })

  it('copies nothing when the closure already holds every reference', () => {
    const repo = makeRepo()
    const deployed = makeDeployed()
    backfillWorkspaceHostClosure(deployed, repo)
    expect(backfillWorkspaceHostClosure(deployed, repo)).toEqual([])
  })
})
