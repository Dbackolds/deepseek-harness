// @vitest-environment jsdom
/** GitBranchSeat: hide, list, checkout, and create against a driven store. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
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
    detached: false,
    worktreePath: '/repo',
    isolated: false,
    dirtyCount: 0,
    unpushedCount: 0,
    branches: [
      { name: 'main', current: true, remote: false },
      { name: 'feature', current: false, remote: false },
      { name: 'origin/dev', current: false, remote: true },
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
    t: (key: keyof typeof en, params?: Record<string, unknown>) => {
      const raw = en[key]
      if (params === undefined) return raw
      return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
    },
  } as unknown as GitBranchSeatProps)} />)
  return actions
}

describe('GitBranchSeat', () => {
  it('still offers create when the repository has no listed branches', () => {
    const actions = renderSeat({
      view: { currentBranch: 'HEAD', detached: true, worktreePath: '/repo', isolated: false, dirtyCount: 0, unpushedCount: 0, branches: [] },
    })
    fireEvent.click(screen.getByRole('button', { name: en['seat.detached'] }))
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

  it('shows dirty and unpushed counts under a detached current checkout', () => {
    renderSeat({
      view: {
        currentBranch: 'cf9fb80',
        detached: true,
        worktreePath: '/repo',
        isolated: false,
        dirtyCount: 2,
        unpushedCount: 1,
        branches: [{ name: 'main', current: false, remote: false }],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: en['seat.detached'] }))
    expect(screen.getAllByText(en['menu.detached']).length).toBeGreaterThan(0)
    expect(screen.getByText('Uncommitted changes: 2 files')).toBeTruthy()
    expect(screen.getByText(en['status.unpushedOne'])).toBeTruthy()
  })

  it('shows dirty and unpushed counts under the current branch', () => {
    renderSeat({
      view: {
        currentBranch: 'main',
        detached: false,
        worktreePath: '/repo',
        isolated: false,
        dirtyCount: 1,
        unpushedCount: 3,
        branches: [
          { name: 'main', current: true, remote: false },
          { name: 'feature', current: false, remote: false },
        ],
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    expect(screen.getByText(en['status.dirtyOne'])).toBeTruthy()
    expect(screen.getByText('Unpushed commits: 3')).toBeTruthy()
  })

  it('checks out a remote-tracking name including the remote', () => {
    const actions = renderSeat()
    fireEvent.click(screen.getByRole('button', { name: /main/ }))
    fireEvent.click(screen.getByText('origin/dev'))
    expect(actions.checkout).toHaveBeenCalledWith('origin/dev')
  })
})
