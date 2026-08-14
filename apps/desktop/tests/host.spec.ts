import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findRepoRoot, resolveDshInvocation, resolveNodeExecutable } from '../src/host.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('desktop host resolution', () => {
  it('walks from the desktop package to the repository root', () => {
    const root = findRepoRoot(here)
    expect(root.replaceAll('\\', '/')).toMatch(/deepseek-harness$/)
    expect(resolveDshInvocation(root).command).toBe(resolveNodeExecutable())
    expect(resolveDshInvocation(root).args.at(-1)?.replaceAll('\\', '/'))
      .toMatch(/apps\/cli\/(?:lib\/bin\.js|src\/bin\.ts)$/)
  })

  it('rejects a directory that is not this checkout', () => {
    expect(() => findRepoRoot(join('C:\\', 'Windows'))).toThrow(/cannot locate the repository root/)
  })
})
