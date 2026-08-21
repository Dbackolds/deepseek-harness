import { describe, it } from 'vitest'
import { asReloadStatus, hostGenerationAfterLoss, progressFromStatus, statusFromMarketplaceSettings, storedRebootNonce } from '../../src/client/reload-status.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const status = asReloadStatus({
  phase: 'done',
  current: '',
  index: 29,
  total: 29,
  ok: 29,
  failed: 0,
  message: '重载完成, 成功重载 29 个插件',
  nonce: 4,
  clientIds: ['@deepseek-ai/dsh-client-ui-conversation'],
  names: ['include:agent-presets:persona', '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'],
  rebootNonce: 2,
})
assert(status?.nonce === 4, 'parses nonce')
assert(status?.rebootNonce === 2, 'parses reboot nonce')
assert(status?.names.join(',') === 'include:agent-presets:persona,@deepseek-ai/dsh-client-ui-settings-plugin-marketplace', 'parses names')
assert(progressFromStatus(status)?.message === '重载完成, 成功重载 29 个插件', 'progress message')
assert(asReloadStatus({ phase: 'nope' }) === undefined, 'rejects unknown phase')
assert(hostGenerationAfterLoss({ seenHost: false, lostHost: false, up: false }).reload === false, 'boot without host does not reload')
assert(hostGenerationAfterLoss({ seenHost: true, lostHost: false, up: false }).lostHost === true, 'host loss is remembered')
assert(hostGenerationAfterLoss({ seenHost: true, lostHost: true, up: true }).reload === true, 'new host generation reloads the page')
assert(storedRebootNonce(null) === undefined, 'missing storage is not a settled reboot')
assert(storedRebootNonce('1') === undefined, 'legacy boolean flag is leftover, not a nonce')
assert(storedRebootNonce('7') === 7, 'numeric nonce settles the card')
assert(statusFromMarketplaceSettings(undefined) === undefined, 'missing settings section is idle')
assert(statusFromMarketplaceSettings({
  reloadNonce: 4,
  rebootNonce: 2,
  reloadClientIds: ['@deepseek-ai/dsh-client-ui-conversation'],
  reloadNames: ['include:agent-presets:persona'],
  reloadProgress: {
    phase: 'done',
    current: '',
    index: 29,
    total: 29,
    ok: 29,
    failed: 0,
    message: '重载完成, 成功重载 29 个插件',
  },
})?.nonce === 4, 'maps settings nonce')
assert(statusFromMarketplaceSettings({
  reloadProgress: { phase: 'running', current: 'ui-conversation', index: 1, total: 2, ok: 0, failed: 0, message: '正在重载' },
})?.phase === 'running', 'maps running progress')


describe('reload-status', () => {
  it('holds the imported assertions', () => {})
})
