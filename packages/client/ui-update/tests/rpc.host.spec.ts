import { describe, expect, it } from 'vitest'
import { handleProductUpdateRpc } from '../src/rpc.ts'
import type { ProductUpdateCheckerOptions } from '../src/checker.ts'
import type { ProductUpdateSettings } from '../src/update-settings.ts'

const BODY = JSON.stringify([{
  tag_name: 'dsh-v1.2.4',
  html_url: 'https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v1.2.4',
  draft: false,
  prerelease: false,
  body: 'notes',
}])

function options(settings: ProductUpdateSettings = {}): ProductUpdateCheckerOptions & { writes: ProductUpdateSettings[] } {
  let current = settings
  const writes: ProductUpdateSettings[] = []
  return {
    env: { DSH_PRODUCT_VERSION: '1.2.3' },
    now: () => 1_700_000_000_000,
    fetch: async () => new Response(BODY, { status: 200 }),
    readSettings: () => current,
    writeSettings: async (next) => {
      current = next
      writes.push(next)
    },
    writes,
  }
}

describe('handleProductUpdateRpc', () => {
  it('checks, dismisses the latest tag, and rejects bad payloads', async () => {
    const opts = options()
    const checked = await handleProductUpdateRpc('check', {}, opts)
    expect(checked.ok).toBe(true)
    if (!checked.ok) throw new Error('expected ok')
    const latest = (checked.value as { latest?: { tag: string } }).latest
    expect(latest?.tag).toBe('dsh-v1.2.4')

    const dismissed = await handleProductUpdateRpc('dismiss', { tag: 'dsh-v1.2.4' }, opts)
    expect(dismissed).toEqual({ ok: true, value: { ok: true } })
    expect(opts.writes.at(-1)?.dismissedTag).toBe('dsh-v1.2.4')
    expect(opts.writes.at(-1)?.lastResult?.available).toBe(false)

    expect(await handleProductUpdateRpc('check', { force: 'yes' }, opts)).toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    expect(await handleProductUpdateRpc('dismiss', { tag: '' }, opts)).toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    expect(await handleProductUpdateRpc('dismiss', 'nope', opts)).toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    expect(await handleProductUpdateRpc('nope', {}, opts)).toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
    expect(await handleProductUpdateRpc('check', 'nope', opts)).toMatchObject({
      ok: false,
      error: { code: 'bad-request' },
    })
  })

  it('maps a checker throw to internal and accepts an explicit force boolean', async () => {
    const opts = options()
    opts.fetch = async () => { throw new Error('offline') }
    const failed = await handleProductUpdateRpc('check', { force: true }, opts)
    expect(failed).toMatchObject({ ok: false, error: { code: 'internal', message: 'offline' } })

    const thrown = options()
    thrown.fetch = async () => { throw 'offline' }
    const failedString = await handleProductUpdateRpc('check', null, thrown)
    expect(failedString.ok).toBe(false)
  })

  it('rethrows AbortError instead of mapping it to internal', async () => {
    const controller = new AbortController()
    controller.abort()
    const opts = options()
    opts.signal = controller.signal
    opts.fetch = async () => { throw new Error('must not fetch') }
    await expect(handleProductUpdateRpc('check', {}, opts)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('dismisses a tag that is not the cached latest without rewriting lastResult', async () => {
    const opts = options({ lastResult: {
      available: true,
      currentVersion: '1.2.3',
      latest: { tag: 'dsh-v1.2.4', version: '1.2.4', url: 'u', notes: '' },
      checkedAt: 1,
      channel: 'dsh',
    } })
    await handleProductUpdateRpc('dismiss', { tag: 'dsh-v9.9.9' }, opts)
    expect(opts.writes[0]?.dismissedTag).toBe('dsh-v9.9.9')
    expect(opts.writes[0]?.lastResult?.available).toBe(true)
  })
})
