// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { LlmPolicyRow } from '../src/client/LlmPolicyRow.tsx'
import type { LlmPolicyRowProps } from '../src/client/LlmPolicyRow.tsx'
import { LlmDefaultPolicyPreference } from '../src/client/policy.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], hiddenWorkspaceIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

function mount() {
  const preference = new LlmDefaultPolicyPreference()
  const setMaxRetries = vi.fn((value: number) => { preference.setMaxRetries(value) })
  const setUnlimited = vi.fn((value: boolean) => { preference.setUnlimited(value) })
  const setStreamIdleTimeoutMs = vi.fn((value: number) => { preference.setStreamIdleTimeoutMs(value) })
  const props: LlmPolicyRowProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useMaxRetries: bindSnapshotSelector(preference.maxRetries),
    useUnlimited: bindSnapshotSelector(preference.unlimited),
    useStreamIdleTimeoutMs: bindSnapshotSelector(preference.streamIdleTimeoutMs),
    setMaxRetries,
    setUnlimited,
    setStreamIdleTimeoutMs,
    t: makeTranslate(en),
  }
  render(<LlmPolicyRow {...props} />)
  return { preference, setMaxRetries, setUnlimited, setStreamIdleTimeoutMs }
}

describe('LlmPolicyRow', () => {
  it('shows the default finite retry count, unlimited off, and timeout in seconds', () => {
    mount()
    expect(screen.getByText('Retry count')).toBeDefined()
    expect(screen.getByText('Request timeout')).toBeDefined()
    expect((screen.getByLabelText('Retry count') as HTMLInputElement).value).toBe('5')
    expect(screen.getByRole('switch', { name: 'Unlimited' }).getAttribute('aria-checked')).toBe('false')
    expect((screen.getByLabelText('Request timeout') as HTMLInputElement).value).toBe('300')
  })

  it('commits a finite retry count and timeout on blur', () => {
    const b = mount()
    const retries = screen.getByLabelText('Retry count')
    fireEvent.change(retries, { target: { value: '8' } })
    fireEvent.blur(retries)
    expect(b.setMaxRetries).toHaveBeenCalledWith(8)
    const timeout = screen.getByLabelText('Request timeout')
    fireEvent.change(timeout, { target: { value: '60' } })
    fireEvent.blur(timeout)
    expect(b.setStreamIdleTimeoutMs).toHaveBeenCalledWith(60_000)
  })

  it('toggles unlimited and disables the finite count', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('switch', { name: 'Unlimited' }))
    expect(b.setUnlimited).toHaveBeenCalledWith(true)
    expect(screen.getByRole('switch', { name: 'Unlimited' }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByLabelText('Retry count') as HTMLInputElement).disabled).toBe(true)
  })

  it('reverts an invalid retry draft on blur', () => {
    mount()
    const retries = screen.getByLabelText('Retry count')
    fireEvent.change(retries, { target: { value: 'nope' } })
    expect(screen.getByText('Enter an integer of 0 or greater.')).toBeDefined()
    fireEvent.blur(retries)
    expect((screen.getByLabelText('Retry count') as HTMLInputElement).value).toBe('5')
  })

  it('follows a later preference change', () => {
    const b = mount()
    act(() => { b.preference.setMaxRetries(9) })
    expect((screen.getByLabelText('Retry count') as HTMLInputElement).value).toBe('9')
  })
})
