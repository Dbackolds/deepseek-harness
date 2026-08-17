import { describe, it } from 'vitest'
import { catalogPackageLabel, installedHoverLabel } from '../../src/client/catalog-label.ts'
import { confirmInstallMessage, installSourceLabel } from '../../src/client/confirm-install.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

const zh = (key: string, params?: Record<string, unknown>): string => {
  if (key !== 'confirmInstallNamed') throw new Error(key)
  return `安装 ${String(params?.name)}@${String(params?.version)}？来源：${String(params?.source)}`
}

assert(
  confirmInstallMessage(zh, {
    name: '@dsh-plugin/dsh-auxiliary',
    version: '0.4.2',
    sourceTitle: 'StarPivot',
    homepage: 'https://github.com/dsh-plugins/dsh-auxiliary',
  }) === '安装 @dsh-plugin/dsh-auxiliary@0.4.2？来源：StarPivot',
  'named confirm',
)
assert(
  confirmInstallMessage(zh, {
    name: 'dsh-find-plugin',
    version: '',
    sourceTitle: '  ',
    homepage: 'https://github.com/awesome-dsh-plugin/dsh-find-plugin',
  }) === '安装 dsh-find-plugin@latest？来源：github.com',
  'homepage host fallback',
)
assert(installSourceLabel('StarPivot', 'https://example.com') === 'StarPivot', 'title wins')
assert(catalogPackageLabel('@dsh-plugin/dsh-auxiliary', '0.4.2') === '@dsh-plugin/dsh-auxiliary@0.4.2', 'versioned package')
assert(catalogPackageLabel('dsh-find-plugin', '') === 'dsh-find-plugin', 'unversioned package')
assert(
  installedHoverLabel('@deepseek-ai/dsh-client-ui-settings-plugin-marketplace', 'file:/tmp/plugin')
    === '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace\nfile:/tmp/plugin',
  'installed hover includes spec',
)
assert(installedHoverLabel('cordis:include', '') === 'cordis:include', 'installed hover without spec')


describe('confirm-install', () => {
  it('holds the imported assertions', () => {})
})
