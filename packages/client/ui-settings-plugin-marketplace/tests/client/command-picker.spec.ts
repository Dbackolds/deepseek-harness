import { describe, it } from 'vitest'
import { commandLine, reloadPickOptions, updatePickOptions } from '../../src/client/command-picker.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const reload = reloadPickOptions(
  [
    { id: 'plugin-marketplace', moduleName: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host' },
    { id: 'ui-conversation', moduleName: '@deepseek-ai/dsh-client-ui-conversation' },
  ],
  '全部可重载插件',
  '不写名字则重载全部',
)
assert(reload[0]?.id === '' && reload[0]?.label === '全部可重载插件', 'reload all first')
assert(reload[1]?.id === 'plugin-marketplace' && reload[1]?.detail === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace/host', 'reload names the module')
assert(commandLine('reload', '') === '/reload', 'bare reload')
assert(commandLine('reload', 'ui-conversation') === '/reload ui-conversation', 'named reload')

const update = updatePickOptions(
  [{ name: '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace' }, { name: 'plain-lib' }],
  '全部依赖',
  '不写名字则更新全部',
)
assert(update.map(row => row.id).join(',') === ',@deepseek-ai/dsh-client-ui-settings-plugin-marketplace,plain-lib', 'update rows')
assert(commandLine('update', 'plain-lib') === '/update plain-lib', 'named update')


describe('command-picker', () => {
  it('holds the imported assertions', () => {})
})
