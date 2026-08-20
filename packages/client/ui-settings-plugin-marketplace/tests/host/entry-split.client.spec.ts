/** Host and browser marketplace rows must not both register /plugin-marketplace. */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { apply as applyClientRow } from '../../src/index.ts'
import { apply as applyHost, MARKETPLACE_CLIENT_ENTRY_ID, MARKETPLACE_HOST_ENTRY_ID } from '../../src/host/index.ts'

const here = dirname(fileURLToPath(import.meta.url))
const patchPath = resolve(here, '../../../../bundle/web-app/cordis.patch.yml')

describe('marketplace Host and browser rows', () => {
  it('gives the Host row ./host and leaves the package entry empty', () => {
    const patch = readFileSync(patchPath, 'utf8')
    expect(patch).toMatch(
      new RegExp(`id: ${MARKETPLACE_HOST_ENTRY_ID}\\n\\s+name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host'`, 'u'),
    )
    expect(patch).toMatch(
      new RegExp(`id: ${MARKETPLACE_CLIENT_ENTRY_ID}\\n\\s+name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'`, 'u'),
    )
    expect(applyClientRow).not.toBe(applyHost)
    applyClientRow()
  })
})
