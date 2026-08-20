// @vitest-environment jsdom
/**
 * AppWebEntry paints the fail-loud page when the host never injected a
 * boot manifest. Parsing before createRoot left #root empty.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { AppWebEntry } from '@deepseek-ai/dsh-client-web/src/boot.tsx'
import type { DshWindow } from '@deepseek-ai/dsh-client-modules/client'

afterEach(cleanup)

describe('AppWebEntry missing boot manifest', () => {
  it('renders the fail-loud report instead of leaving #root empty', async () => {
    delete (globalThis as DshWindow).__DSH_BOOT__
    const root = document.createElement('div')
    document.body.append(root)
    const entry = new AppWebEntry(root)
    await act(async () => { await entry.run() })
    expect(root.textContent).toContain('Failed to load plugins')
    expect(root.textContent).toContain('window.__DSH_BOOT__ is missing or not an object')
    entry.dispose()
    root.remove()
  })
})
