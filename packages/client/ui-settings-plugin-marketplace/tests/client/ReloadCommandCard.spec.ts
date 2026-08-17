import { describe, it } from 'vitest'
import { reloadCardCopy } from '../../src/client/reload-card.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const accepted = {
  name: 'reload',
  outcome: {
    kind: 'success' as const,
    text: '正在重载 29 个插件\n\ninclude:agent-presets:persona\ninclude:agent-presets:agent-instructions',
  },
}

const running = reloadCardCopy(accepted, {
  phase: 'running', current: 'ui-skill', index: 3, total: 29, ok: 2, failed: 0, message: '',
})
assert(running.summary === '正在重载 29 个插件', running.summary)
assert(running.state === 'running', 'accepted card stays running until progress is done')
assert(running.body?.includes('include:agent-presets:persona') === true, 'plugin list stays in the body')

const settled = reloadCardCopy({
  name: 'reload',
  outcome: {
    kind: 'success',
    text: '重载完成, 成功重载 29 个插件\n\ninclude:agent-presets:persona',
  },
}, undefined)
assert(settled.summary === '重载完成, 成功重载 29 个插件', settled.summary)
assert(settled.state === 'ok', 'settled command text is enough')
assert(settled.body === 'include:agent-presets:persona', 'finished card stays expandable')
const fromNames = reloadCardCopy({
  name: 'reload',
  outcome: { kind: 'success', text: '重载完成, 成功重载 2 个插件' },
}, undefined, ['include:agent-presets:persona', 'include:agent-presets:agent-instructions'])
assert(fromNames.body?.includes('include:agent-presets:persona') === true, 'names keep the card expandable')

const runningFromLive = reloadCardCopy({
  name: 'reload',
  outcome: null,
}, {
  phase: 'running', current: 'ui-skill', index: 1, total: 2, ok: 0, failed: 0, message: '正在重载 2 个插件',
}, ['include:agent-presets:persona', 'plugin-marketplace'])
assert(runningFromLive.summary === '正在重载 2 个插件', runningFromLive.summary)
assert(runningFromLive.body === 'include:agent-presets:persona\nplugin-marketplace', 'live names expand a still-running row')

const done = reloadCardCopy(accepted, {
  phase: 'done', current: '', index: 29, total: 29, ok: 29, failed: 0, message: '重载完成, 成功重载 29 个插件',
})
assert(done.summary === '重载完成, 成功重载 29 个插件', done.summary)
assert(done.state === 'ok', 'done is ok')
assert(done.body?.includes('include:agent-presets:agent-instructions') === true, 'expanded list survives')

const failed = reloadCardCopy(accepted, {
  phase: 'done', current: '', index: 29, total: 29, ok: 27, failed: 2, message: '重载完成, 成功重载 27 个插件, 失败 2 个',
})
assert(failed.summary === '重载完成, 成功重载 27 个插件, 失败 2 个', failed.summary)
assert(failed.state === 'error', 'failures mark the row as error')

const rebootPending = reloadCardCopy({
  name: 'reboot',
  outcome: { kind: 'success', text: '正在重启，页面即将刷新' },
}, undefined)
assert(rebootPending.summary === '正在重启，页面即将刷新', rebootPending.summary)
assert(rebootPending.state === 'running', 'reboot stays pending until the new host is up')
const leftover = reloadCardCopy({
  name: 'reboot',
  outcome: { kind: 'success', text: '正在重启，页面即将刷新' },
}, undefined, [], { rebootSettled: false })
assert(leftover.summary === '正在重启，页面即将刷新', leftover.summary)
assert(leftover.state === 'running', 'a leftover reboot flag must not settle the card')
const rebootDone = reloadCardCopy({
  name: 'reboot',
  outcome: { kind: 'success', text: '正在重启，页面即将刷新' },
}, undefined, [], { rebootSettled: true })
assert(rebootDone.summary === '已重启', rebootDone.summary)
assert(rebootDone.state === 'ok', 'reboot card settles after refresh')


describe('ReloadCommandCard', () => {
  it('holds the imported assertions', () => {})
})
