import { describe, it } from 'vitest'
import {
  MARKETPLACE_CLIENT_PACKAGE, findMarketplaceClientEntry, reloadMarketplacePage,
  selectPageReloadIds,
} from '../../src/client/reload-page.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const other = {
  options: { name: '@deepseek-ai/dsh-client-store' },
  ctx: { registry: { delete() {} } },
  async refresh() {},
}
const deleted: unknown[] = []
const marketplace = {
  options: { name: MARKETPLACE_CLIENT_PACKAGE },
  fiber: {
    runtime: { callback: 'old' },
    await: async () => {},
  },
  ctx: {
    registry: {
      delete(callback: unknown) { deleted.push(callback) },
    },
  },
  refreshed: 0,
  async refresh() { this.refreshed += 1 },
}
assert(
  findMarketplaceClientEntry({ entries: () => [other, marketplace] }) === marketplace,
  'finds marketplace client by package name',
)

const steps: string[] = []
const result = await reloadMarketplacePage({
  loader: { entries: () => [other, marketplace] },
  modules: {
    invalidate(id) { steps.push(`invalidate:${id}`) },
    async prefetch(id) { steps.push(`prefetch:${id}`) },
  },
  removeOwnedStyles(id) { steps.push(`styles:${id}`) },
})
assert(result === 'reloaded', 'reloads marketplace page')
assert(steps.join(',') === [
  `invalidate:${MARKETPLACE_CLIENT_PACKAGE}`,
  `prefetch:${MARKETPLACE_CLIENT_PACKAGE}`,
  `styles:${MARKETPLACE_CLIENT_PACKAGE}`,
].join(','), 'official invalidate-prefetch-teardown order')
assert(deleted.join(',') === 'old', 'drops old runtime before refresh')
assert(marketplace.fiber === undefined, 'clears old fiber so refresh remounts')
assert(marketplace.refreshed === 1, 'refresh remounts only this entry')

const skipped = await reloadMarketplacePage({})
assert(skipped === 'skipped', 'missing loader skips instead of swapping the whole table')
assert(
  selectPageReloadIds([
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-conversation',
    MARKETPLACE_CLIENT_PACKAGE,
  ]).join(',') === `@deepseek-ai/dsh-client-ui-conversation,${MARKETPLACE_CLIENT_PACKAGE}`,
  'page chrome stays mounted while overlay UI can still swap',
)


describe('reload-page', () => {
  it('holds the imported assertions', () => {})
})
