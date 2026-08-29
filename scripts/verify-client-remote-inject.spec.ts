/** Client panels must declare the Remote namespaces they read. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanClientRemoteInject, verifyClientRemoteInject } from './verify-client-remote-inject.ts'

const root = join(import.meta.dirname, '..')
const scratch = mkdtempSync(join(tmpdir(), 'dsh-remote-inject-'))

afterEach(() => {
  for (const entry of ['good', 'bad-direct', 'bad-store']) {
    rmSync(join(scratch, entry), { recursive: true, force: true })
  }
})

function makePackage(name: string, inject: string, files: Record<string, string>): string {
  const dir = join(scratch, name)
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(join(dir, 'src', 'client', file.split('/').slice(0, -1).join('/')), { recursive: true })
    writeFileSync(join(dir, 'src', 'client', file), source)
  }
  writeFileSync(join(dir, 'src', 'client', 'index.ts'), `export const inject = [${inject}]\n`)
  return dir
}

describe('scanClientRemoteInject', () => {
  it('accepts direct reads whose namespaces are declared', () => {
    const dir = makePackage('good', "'slots', 'remote', 'remote.settings'", {
      'panel.ts': 'const value = ctx.remote.settings.describe()\n',
    })
    expect(scanClientRemoteInject(dir).findings).toEqual([])
  })

  it('flags a direct ctx.remote read without the declaration', () => {
    const dir = makePackage('bad-direct', "'slots', 'remote'", {
      'panel.ts': 'const value = ctx.remote.settings.describe()\n',
    })
    expect(scanClientRemoteInject(dir).findings).toEqual([
      { packageName: 'bad-direct', file: join(dir, 'src', 'client'), namespace: 'settings' },
    ])
  })

  it('flags a store reading this.api when the file passes ctx.remote onward', () => {
    const dir = makePackage('bad-store', "'slots', 'remote'", {
      'apply.ts': 'const store = new Store(ctx.remote, ctx.sessions)\n',
      'store.ts': 'this.api.automation.list()\n',
    })
    // index.ts itself is regenerated after the fixture write, so re-read the scan.
    const scan = scanClientRemoteInject(dir)
    expect(scan.read.has('automation')).toBe(true)
    expect(scan.findings.map(f => f.namespace)).toContain('automation')
  })

  it('ignores namespace handles bound to their own variable names', () => {
    const dir = makePackage('good-handle', "'remote', 'remote.messageFeedback'", {
      'controller.ts': 'this.remote.put({})\nthis.remote.list({})\n',
    })
    expect(scanClientRemoteInject(dir).findings).toEqual([])
  })
})

describe('verifyClientRemoteInject', () => {
  it('finds no violations in this repository', () => {
    expect(verifyClientRemoteInject(root)).toEqual([])
  })
})
