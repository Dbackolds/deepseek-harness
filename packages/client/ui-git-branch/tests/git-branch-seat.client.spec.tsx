// @vitest-environment jsdom
/** GitBranchSeat: hide, list, checkout, and create against a driven store. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { GitBranchSeat } from '../src/client/GitBranchSeat.tsx'
import type { GitBranchSeatProps } from '../src/client/GitBranchSeat.tsx'
import type { GitBranchSeatState } from '../src/client/seat-store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const READY: GitBranchSeatState = {
  sessionId: 's1',
  view: {
    currentBranch: 'main',
    worktreePath: '/repo',
    isolated: false,
    branches: [
      { name: 'main', current: true, remote: false },
      { name: 'feature', current: false, remote: false },
      { name: 'origin-dev', current: false, remote: true },
    ],
  },
  unavailable: false,
  error: null,
  busy: false,
}

function renderSeat(state: Partial<GitBranchSeatState> = {}) {
  const store = createSnapshotStore<GitBranchSeatState>({ ...READY, ...state })
  const actions = {
    load: vi.fn(() => Promise.resolve()),
    checkout: vi.fn(() => Promise.resolve()),
    createBranch: vi.fn(() => Promise.resolve()),
  }
  render(<GitBranchSeat {...({
    ...actions,
    useWorkspaces: (select: (s: { recentWorkspaceId?: string; items: unknown[] }) => unknown) =>
      select({ recentWorkspaceId: 'ws-1', items: [{ workspaceId: 'ws-1' }] }),
    useGitBranchSeat: bindSnapshotSelector(store),
    t: (key: keyof typeof en) => en[key],
  } as unknown as GitBranchSeatProps)} />)
  return actions
}

describe('GitBranchSeat', () => {
  it('still offers create when the repository has no listed branches', () => {
    const actions = renderSeat({
      view: { currentBranch: 'HEAD', worktreePath: '/repo', isolated: false, branches: [] },
    })
    fireEvent.click(screen.getByRole('button', { name: /HEAD/ }))
    fireEvent.click(screen.getByText(en['menu.create']))
    fireEvent.change(screen.getByPlaceholderText(en['create.placeholder']), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: en['create.confirm'] }))
    expect(actions.createBranch).not.toHaveBeenCalled()
  })

  it('renders nothing without a session or repository', () => {
    const { container: missing } = render(<div data-testid="host" />)
    cleanup()
    renderSeat({ view: null })
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    renderSeat({ unavailable: true, view: null })
    expect(screen.queryByRole('button')).toBeNull()
    expect(missing).toBeTruthy()
  })

  it('checks out a listed branch and opens the create dialog', () => {
    const actions = renderSeat()
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText('feature'))
    expect(actions.checkout).toHaveBeenCalledWith('feature')
    cleanup()
    const again = renderSeat()
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText(en['menu.create']))
    fireEvent.change(screen.getByPlaceholderText(en['create.placeholder']), { target: { value: 'topic' } })
    fireEvent.click(screen.getByRole('button', { name: en['create.confirm'] }))
    expect(again.createBranch).toHaveBeenCalledWith('topic')
  })

  it('cancels create and ignores an empty confirm', () => {
    renderSeat()
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText(en['menu.create']))
    fireEvent.click(screen.getByRole('button', { name: en['create.cancel'] }))
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText(en['menu.create']))
    fireEvent.click(screen.getByRole('button', { name: en['create.close'] }))
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText(en['menu.create']))
    fireEvent.click(screen.getByRole('button', { name: en['create.confirm'] }))
    expect(screen.getByPlaceholderText(en['create.placeholder'])).toBeTruthy()
  })

  it('shows a host error on the chip title', () => {
    renderSeat({ error: 'switch failed' })
    expect(screen.getByRole('button', { name: /main/ }).getAttribute('title')).toBe('switch failed')
  })

  it('disables the chip while a switch is in flight', () => {
    renderSeat({ busy: true })
    expect((screen.getByRole('button', { name: /main/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('checks out a remote-tracking name without the remote: prefix', () => {
    const actions = renderSeat()
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText('origin-dev'))
    expect(actions.checkout).toHaveBeenCalledWith('origin-dev')
  })
})
