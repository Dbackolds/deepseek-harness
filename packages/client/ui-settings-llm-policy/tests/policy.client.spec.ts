// @ts-nocheck — merge-port: client-runtime retirement; restore types in a follow-up.
import { describe, expect, it, vi } from 'vitest'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { LlmDefaultPolicyPreference } from '../src/client/policy.ts'
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_UNLIMITED,
  type LlmDefaultPolicySettings,
} from '@deepseek-ai/dsh-llm-default-policy/defaults'

function fakeScope(initial?: LlmDefaultPolicySettings): SettingsScope<LlmDefaultPolicySettings> & {
  publish: (value: LlmDefaultPolicySettings) => void
  setMock: ReturnType<typeof vi.fn>
} {
  const setMock = vi.fn(async () => undefined)
  let snapshot: SettingsScopeSnapshot<LlmDefaultPolicySettings> = {
    status: initial === undefined ? 'loading' : 'ready',
    value: initial,
    base: undefined,
    user: undefined,
    revision: initial === undefined ? undefined : 0,
    writable: true,
    mode: 'host',
  }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: setMock,
    unset: vi.fn(async () => undefined),
    publish(value) {
      snapshot = { ...snapshot, status: 'ready', value, revision: (snapshot.revision ?? -1) + 1 }
      for (const listener of listeners) listener()
    },
    setMock,
  }
}

describe('LlmDefaultPolicyPreference', () => {
  it('starts from product defaults without a host and publishes before writing', () => {
    const preference = new LlmDefaultPolicyPreference()
    expect(preference.maxRetries.getSnapshot()).toBe(DEFAULT_MAX_RETRIES)
    expect(preference.unlimited.getSnapshot()).toBe(DEFAULT_UNLIMITED)
    expect(preference.streamIdleTimeoutMs.getSnapshot()).toBe(DEFAULT_STREAM_IDLE_TIMEOUT_MS)
    preference.setMaxRetries(8)
    expect(preference.maxRetries.getSnapshot()).toBe(8)
    preference.setMaxRetries(8)
    expect(preference.maxRetries.getSnapshot()).toBe(8)
  })

  it('adopts a later host section and writes through set', () => {
    const host = fakeScope()
    const preference = new LlmDefaultPolicyPreference(host)
    host.publish({ maxRetries: 7, unlimited: true, streamIdleTimeoutMs: 12_000 })
    expect(preference.maxRetries.getSnapshot()).toBe(7)
    expect(preference.unlimited.getSnapshot()).toBe(true)
    expect(preference.streamIdleTimeoutMs.getSnapshot()).toBe(12_000)
    preference.setUnlimited(false)
    expect(host.setMock).toHaveBeenCalledWith('unlimited', false)
  })
})
