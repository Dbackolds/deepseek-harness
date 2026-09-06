/** SessionHistoryGatePreference: scope adoption, optimistic writes, revert, disposal. */
import { describe, expect, it, vi } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { SessionHistoryGatePreference } from '../src/client/preference.ts'
import type { SessionHistoryToolsSettings } from '../src/client/preference.ts'

function readyScope(enabled: boolean, writable = true) {
  const stub = stubSettingsScope<SessionHistoryToolsSettings>()
  stub.publish({ status: 'ready', value: { enabled }, revision: 0, writable })
  return stub
}

describe('SessionHistoryGatePreference', () => {
  it('stays closed and read-only while the namespace has not loaded', () => {
    const stub = stubSettingsScope<SessionHistoryToolsSettings>()
    const preference = new SessionHistoryGatePreference(stub.scope)
    expect(preference.enabled.getSnapshot()).toBe(false)
    expect(preference.writable.getSnapshot()).toBe(false)
    expect(stub.listenerCount()).toBe(1)
  })

  it('ignores toggles while loading or read-only, and when the value already matches', () => {
    const loading = stubSettingsScope<SessionHistoryToolsSettings>()
    const loadingPreference = new SessionHistoryGatePreference(loading.scope)
    loadingPreference.setEnabled(true)
    expect(loading.set).not.toHaveBeenCalled()
    expect(loadingPreference.enabled.getSnapshot()).toBe(false)

    const readOnly = readyScope(false, false)
    const readOnlyPreference = new SessionHistoryGatePreference(readOnly.scope)
    readOnlyPreference.setEnabled(true)
    expect(readOnly.set).not.toHaveBeenCalled()
    expect(readOnlyPreference.enabled.getSnapshot()).toBe(false)

    const stable = readyScope(true)
    const stablePreference = new SessionHistoryGatePreference(stable.scope)
    stablePreference.setEnabled(true)
    expect(stable.set).not.toHaveBeenCalled()
  })

  it('adopts an accepted section and its writability', () => {
    const stub = stubSettingsScope<SessionHistoryToolsSettings>()
    const preference = new SessionHistoryGatePreference(stub.scope)
    stub.publish({ status: 'ready', value: { enabled: true }, revision: 4, writable: true })
    expect(preference.enabled.getSnapshot()).toBe(true)
    expect(preference.writable.getSnapshot()).toBe(true)
    stub.publish({ status: 'ready', value: { enabled: true }, revision: 5, writable: false })
    expect(preference.writable.getSnapshot()).toBe(false)
  })

  it('publishes optimistically and keeps the value once the write lands', async () => {
    const stub = readyScope(false)
    stub.set.mockImplementation((_field: string, value: unknown) => {
      stub.publish({ status: 'ready', value: { enabled: value as boolean }, revision: 1, writable: true })
      return Promise.resolve()
    })
    const preference = new SessionHistoryGatePreference(stub.scope)
    preference.setEnabled(true)
    expect(preference.enabled.getSnapshot()).toBe(true)
    expect(preference.saving.getSnapshot()).toBe(true)
    expect(stub.set).toHaveBeenCalledWith('enabled', true)
    await vi.waitFor(() => { expect(preference.saving.getSnapshot()).toBe(false) })
    expect(preference.enabled.getSnapshot()).toBe(true)
  })

  it('reverts the visible value when the write never lands', async () => {
    const stub = readyScope(false)
    const preference = new SessionHistoryGatePreference(stub.scope)
    preference.setEnabled(true)
    expect(preference.enabled.getSnapshot()).toBe(true)
    await vi.waitFor(() => { expect(preference.saving.getSnapshot()).toBe(false) })
    expect(preference.enabled.getSnapshot()).toBe(false)
  })

  it('swallows a rejected write and reverts to the accepted section', async () => {
    const stub = readyScope(true)
    stub.set.mockRejectedValueOnce(new Error('offline'))
    const preference = new SessionHistoryGatePreference(stub.scope)
    preference.setEnabled(false)
    expect(preference.enabled.getSnapshot()).toBe(false)
    await vi.waitFor(() => { expect(preference.saving.getSnapshot()).toBe(false) })
    expect(preference.enabled.getSnapshot()).toBe(true)
  })

  it('stops observing and suppresses late write settlements after disposal', async () => {
    const stub = readyScope(false)
    let settle!: () => void
    stub.set.mockReturnValue(new Promise<void>((resolve) => { settle = resolve }))
    const preference = new SessionHistoryGatePreference(stub.scope)
    preference.setEnabled(true)
    expect(preference.saving.getSnapshot()).toBe(true)
    preference.dispose()
    expect(preference.saving.getSnapshot()).toBe(false)
    expect(stub.listenerCount()).toBe(0)
    settle()
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(preference.enabled.getSnapshot()).toBe(true)
  })
})
