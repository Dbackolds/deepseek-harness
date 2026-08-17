import { describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCatalogDocument } from '../../src/host/catalog.ts'
import { DEFAULT_CATALOG_URL } from '../../src/host/defaults.ts'
import {
  formatReloadAccepted, formatReloadFinished, formatReloadOutcome, isIncludeContainer, isMarketplaceEntry,
  isSkeletonEntry, matchReloadTarget, partitionReloadEntries, reloadHostEntry,
  requestBrowserReboot, requestBrowserReload, selectClientReloadIds, selectReloadEntries,
  snapshotFromSettings,
} from '../../src/host/reload.ts'
import { listReloadTargets, listUpdateTargets } from '../../src/host/command-targets.ts'
import { resolveUpdateTarget } from '../../src/host/update.ts'
import { argvWithPort, desktopOwnsHost, rebootBlocked, REBOOT_ENV } from '../../src/host/reboot.ts'
import { pinAutoReloadOff } from '../../src/host/hmr-pin.ts'

const entries = [
  { id: 'plugin-marketplace', moduleName: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host' },
  { id: 'llm', moduleName: '@deepseek-ai/dsh-llm' },
  { id: 'session', moduleName: '@deepseek-ai/dsh-session' },
]

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

assert(DEFAULT_CATALOG_URL === '/plugin-catalog/catalog.json', 'default catalog url')
try {
  const localCatalog = resolve(dirname(fileURLToPath(import.meta.url)), '../../../host/plugin-catalog/catalog.json')
  const parsedCatalog = parseCatalogDocument(JSON.parse(readFileSync(localCatalog, 'utf8')), DEFAULT_CATALOG_URL)
  assert(parsedCatalog.ok, 'local catalog parses')
  if (parsedCatalog.ok) {
    assert(parsedCatalog.title === 'StarPivot', 'catalog title')
    assert(parsedCatalog.entries.some(entry => entry.name === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'), 'catalog lists marketplace')
    assert(parsedCatalog.entries.every(entry => entry.kind === 'bundle'), 'catalog bundles only')
    assert(parsedCatalog.entries.every(entry => entry.updatedAt !== undefined), 'catalog publish times')
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}

assert(matchReloadTarget(entries, '').kind === 'all', 'empty query reloads all')
assert(matchReloadTarget(entries, 'llm').kind === 'one', 'id match')
assert(matchReloadTarget(entries, '@deepseek-ai/dsh-session').kind === 'one', 'module match')
assert(matchReloadTarget(entries, 'missing').kind === 'none', 'unknown')
assert(isSkeletonEntry('connection', '@deepseek-ai/dsh-client-connection'), 'connection is skeleton')
assert(isSkeletonEntry('include:session', '@deepseek-ai/dsh-session'), 'nested session is skeleton')
assert(isSkeletonEntry('include:agent-presets', '@deepseek-ai/dsh-agent-presets'), 'include container stays live')
assert(!isSkeletonEntry('include:agent-presets:tool-fs', '@deepseek-ai/dsh-tool-fs'), 'leaf tools stay reloadable')
assert(!isSkeletonEntry('plain-plugin', 'plain-lib'), 'extra plugin is not skeleton')
const selectedAll = selectReloadEntries([
  { id: 'include:session', moduleName: '@deepseek-ai/dsh-session', enabled: true, async refresh() {} },
  { id: 'include:llm', moduleName: '@deepseek-ai/dsh-llm', enabled: true, async refresh() {} },
  { id: 'include:agent-presets', moduleName: '@deepseek-ai/dsh-agent-presets', enabled: true, async refresh() {} },
  { id: 'include:agent-presets:tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: true, async refresh() {} },
  { id: 'include:agent-presets:tool-bash', moduleName: '@deepseek-ai/dsh-tool-bash', enabled: true, async refresh() {} },
  { id: 'ui-skill', moduleName: '@deepseek-ai/dsh-client-ui-skill', enabled: true, async refresh() {} },
  { id: 'plain', moduleName: 'plain-lib', enabled: true, async refresh() {} },
], { kind: 'all' })
assert(selectedAll.ok && selectedAll.selected.map(entry => entry.id).join(',') === 'include:agent-presets:tool-fs,include:agent-presets:tool-bash,ui-skill,plain', 'all reloads leaf tools and skips include containers')
const namedTool = selectReloadEntries([
  { id: 'include:agent-presets:tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs', enabled: true, async refresh() {} },
], { kind: 'one', entry: { id: 'include:agent-presets:tool-fs', moduleName: '@deepseek-ai/dsh-tool-fs' } })
assert(namedTool.ok, 'named leaf tool is reloadable')
const accepted = formatReloadAccepted(selectedAll.ok ? selectedAll.selected : [])
assert(accepted.includes('\ninclude:agent-presets:tool-fs'), 'accepted text lists plugins')
assert(accepted.split('\n')[0] === '正在重载 4 个插件', 'accepted summary stays on first line')
assert(formatReloadFinished(29, 0) === '重载完成, 成功重载 29 个插件', 'finished summary')
assert(formatReloadFinished(27, 2) === '重载完成, 成功重载 27 个插件, 失败 2 个', 'finished summary with failures')
assert(
  formatReloadOutcome('重载完成, 成功重载 2 个插件', ['plain', 'plugin-marketplace'])
    === '重载完成, 成功重载 2 个插件\n\nplain\nplugin-marketplace',
  'settled text keeps the expandable plugin list',
)
assert(snapshotFromSettings({
  reloadNonce: 19,
  reloadClientIds: ['@deepseek-ai/dsh-client-ui-conversation'],
  reloadProgress: { phase: 'done', current: '', index: 63, total: 65, ok: 63, failed: 0, message: '重载完成, 成功重载 65 个插件' },
}).message === '重载完成, 成功重载 65 个插件', 'restores finished progress after marketplace self-reload')
assert(snapshotFromSettings({
  rebootNonce: 7,
  reloadProgress: { phase: 'idle' },
}).rebootNonce === 7, 'restores reboot nonce after host restart')
assert(isIncludeContainer('include:agent-presets'), 'bare include is a container')
assert(!isIncludeContainer('include:agent-presets:tool-fs'), 'leaf under include is not a container')
assert(isSkeletonEntry('include:llm', '@deepseek-ai/dsh-llm'), 'nested llm is skeleton')
const namedCore = selectReloadEntries([
  { id: 'connection', moduleName: '@deepseek-ai/dsh-client-connection', enabled: true, async refresh() {} },
], { kind: 'one', entry: { id: 'connection', moduleName: '@deepseek-ai/dsh-client-connection' } })
assert(!namedCore.ok, 'named skeleton requires reboot')
assert(!isSkeletonEntry('ui-skill', '@deepseek-ai/dsh-client-ui-skill'), 'overlay ui plugin is reloadable')
assert(isMarketplaceEntry('plugin-marketplace', '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host'), 'marketplace host')
assert(!isSkeletonEntry('plugin-marketplace', '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host'), 'marketplace is reloadable last')
const split = partitionReloadEntries([
  { id: 'plain', moduleName: 'plain-lib', enabled: true, async refresh() {} },
  { id: 'plugin-marketplace', moduleName: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host', enabled: true, async refresh() {} },
])
assert(split.others.map(entry => entry.id).join(',') === 'plain', 'others first')
assert(split.marketplace.map(entry => entry.id).join(',') === 'plugin-marketplace', 'marketplace last')
assert(
  selectClientReloadIds([
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace',
  ], { kind: 'all' }).join(',') === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace',
  'bare /reload does not unload the page chrome',
)
assert(
  selectClientReloadIds([
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace',
  ], { kind: 'one', entry: { id: 'ui-conversation', moduleName: '@deepseek-ai/dsh-client-ui-conversation' } }).join(',')
    === '@deepseek-ai/dsh-client-ui-conversation',
  'named UI plugin reloads only that page plugin',
)
const reloadNames = listReloadTargets([
  { id: 'connection', moduleName: '@deepseek-ai/dsh-client-connection', enabled: true },
  { id: 'plugin-marketplace', moduleName: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host', enabled: true },
  { id: 'ui-conversation', moduleName: '@deepseek-ai/dsh-client-ui-conversation', enabled: true },
  { id: 'disabled', moduleName: 'plain-lib', enabled: false },
])
assert(reloadNames.map(entry => entry.id).join(',') === 'plugin-marketplace,ui-conversation', 'complete only reloadable entries')
assert(listUpdateTargets(['plain-lib', '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace']).map(entry => entry.name).join(',')
  === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace,plain-lib', 'update completion is sorted')
assert(resolveUpdateTarget(['@deepseek-ai/dsh-client-ui-settings-plugin-marketplace', 'plain-lib'], '').kind === 'all', 'update all')
assert(resolveUpdateTarget(['plain-lib'], 'plain-lib').kind === 'one', 'update one')
assert(resolveUpdateTarget(['plain-lib'], 'cordis:include').kind === 'none', 'inbox cannot update')
assert(rebootBlocked(20_000, { [REBOOT_ENV]: '10000' }) === undefined, 'reboot is never cooled down')
assert(desktopOwnsHost({ DSH_DESKTOP: '1' }), 'desktop Host exits without a watchdog')
assert(!desktopOwnsHost({}), 'a terminal Host still needs the watchdog')
assert(argvWithPort(['web', '--port', '0'], 57758).join(' ') === 'web --port 57758', 'reboot keeps the live desktop port')
assert(argvWithPort(['web', '--port=0'], 57758).join(' ') === 'web --port=57758', 'equals port form is rewritten')
assert(argvWithPort(['web'], 57758).join(' ') === 'web --port 57758', 'missing port is added')
const writes: object[] = []
const hmr = {
  autoReload: undefined as boolean | undefined,
  get() { return this.autoReload === undefined ? undefined : { autoReload: this.autoReload } },
  async update(_ns: unknown, patch: object) {
    writes.push(patch)
    this.autoReload = (patch as { autoReload: boolean }).autoReload
  },
}
await pinAutoReloadOff(hmr)
assert(writes.length === 0, 'missing autoReload is already off and must not write')
hmr.autoReload = false
await pinAutoReloadOff(hmr)
assert(writes.length === 0, 'already-off is left alone')
hmr.autoReload = true
await pinAutoReloadOff(hmr)
assert(hmr.autoReload === false, 'true autoReload is forced off')
const exploding = {
  get() { return { autoReload: true } },
  update() { throw new Error('settings namespace "client-hmr" is not registered') },
}
assert(await pinAutoReloadOff(exploding) === undefined, 'unregistered namespace must not throw')

const calls: string[] = []
const entry = {
  id: 'llm',
  moduleName: '@deepseek-ai/dsh-llm',
  enabled: true,
  fiber: {
    async dispose() { calls.push('dispose') },
    async await() { calls.push('await') },
  } as { dispose(): Promise<unknown>; await(): Promise<unknown> } | undefined,
  async refresh() {
    calls.push('refresh')
    this.fiber = {
      async dispose() { calls.push('dispose2') },
      async await() { calls.push('await') },
    }
  },
}
const result = await reloadHostEntry(entry)
assert(result.ok, 'reload ok')
assert(calls.join(',') === 'dispose,refresh,await', 'order ' + calls.join(','))

const official: string[] = []
const officialEntry = {
  id: 'include:agent-presets:tool-fs',
  moduleName: '@deepseek-ai/dsh-tool-fs',
  enabled: true,
  async reload() { official.push('reload') },
  async refresh() { official.push('refresh') },
}
const officialResult = await reloadHostEntry(officialEntry)
assert(officialResult.ok, 'official reload ok')
assert(official.join(',') === 'reload', 'uses official dispose+refresh path')

const settings = {
  nonce: 3,
  get() { return { reloadNonce: this.nonce } },
  async update(_ns: unknown, patch: object) {
    this.nonce = (patch as { reloadNonce: number }).reloadNonce
  },
}
const requested = await requestBrowserReload(
  settings,
  'plugin-marketplace',
  ['@deepseek-ai/dsh-client-ui-conversation'],
)
assert(requested === '已请求浏览器重载 1 个界面插件', 'browser reload request text')
assert(settings.nonce === 4, 'nonce bumps so the page can swap overlay UI')
const rebootSettings = {
  rebootNonce: 1,
  get() { return { rebootNonce: this.rebootNonce } },
  async update(_ns: unknown, patch: object) {
    this.rebootNonce = (patch as { rebootNonce: number }).rebootNonce
  },
}
assert(await requestBrowserReboot(rebootSettings, 'plugin-marketplace') === 2, 'reboot nonce bumps')
assert(rebootSettings.rebootNonce === 2, 'reboot nonce is persisted')


describe('reload', () => {
  it('holds the imported assertions', () => {})
})
