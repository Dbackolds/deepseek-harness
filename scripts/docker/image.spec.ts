/** StarPivot container image: this checkout, not an official npm install. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDshArgs } from '../../apps/cli/src/args.ts'

const root = resolve(import.meta.dirname, '../..')

function readRepo(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8')
}

describe('StarPivot container image', () => {
  it('binds all interfaces through a launcher --patch, not --host 0.0.0.0', () => {
    const overlay = readRepo('docker/webserver.cordis.yml')
    expect(overlay).toContain('id: webserver')
    expect(overlay).toContain('host: 0.0.0.0')
    expect(overlay).toContain('port: !!js ctx.webStartup.port ?? 3080')
    expect(overlay).not.toMatch(/^s*--host/m)

    const invocation = parseDshArgs([
      'web',
      '--patch',
      '/etc/dsh/webserver.cordis.yml',
      '--no-open',
      '--port',
      '3080',
    ], '0.0.0')
    expect(invocation).toEqual({
      mode: 'profile',
      profile: 'web',
      patches: ['/etc/dsh/webserver.cordis.yml'],
      args: ['--no-open', '--port', '3080'],
    })
  })

  it('builds this checkout into ghcr.io/starpivotnet/deepseek-harness', () => {
    const dockerfile = readRepo('docker/Dockerfile')
    expect(dockerfile).toContain('pnpm --filter @deepseek-ai/dsh deploy --legacy --prod')
    expect(dockerfile).toContain('Do not start from an official')
    expect(dockerfile).toContain('ARG DSH_CLIENT_COMMIT_HASH')
    expect(dockerfile).toContain('test -n "$DSH_CLIENT_COMMIT_HASH"')
    expect(dockerfile).toContain('node scripts/docker/restore-vendored-host.ts --deployed /out/dsh')
    expect(dockerfile).not.toContain('pnpm exec tsx scripts/docker/restore-vendored-host.ts')
    expect(dockerfile.indexOf('--patch')).toBeLessThan(dockerfile.indexOf('--no-open'))
    expect(dockerfile).toContain('/etc/dsh/webserver.cordis.yml')

    const compose = readRepo('docker/compose.yml')
    expect(compose).toContain('ghcr.io/starpivotnet/deepseek-harness:latest')
    expect(compose).toContain('dockerfile: docker/Dockerfile')
    expect(compose).toContain('DSH_CLIENT_COMMIT_HASH: ${DSH_CLIENT_COMMIT_HASH:-}')

    const workflow = readRepo('.github/workflows/release-docker.yml')
    expect(workflow).toContain('IMAGE_NAME: starpivotnet/deepseek-harness')
    expect(workflow).toContain("- 'desktop-v*'")
    expect(workflow).toContain("- 'docker-v*'")
    expect(workflow).toContain('packages: write')
    expect(workflow).toContain('DSH_CLIENT_COMMIT_HASH=${{ github.sha }}')
    expect(workflow).toContain('docker pull "$IMAGE"')
  })
})
