// @vitest-environment jsdom
/** Section behavior over a driven snapshot store. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import {
  JOB_BUSY_FIELD, REPORT_BUSY_FIELD, SETTLEMENT_BUSY_FIELD,
} from '../src/delivery-settings.ts'
import type { SubagentBusyDelivery } from '../src/delivery-settings.ts'
import { SubagentsSection } from '../src/client/SubagentsSection.tsx'
import type { SubagentsSectionProps } from '../src/client/SubagentsSection.tsx'
import type { SubagentsState } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const READY: SubagentsState = {
  status: 'ready',
  error: null,
  writable: true,
  revision: 1,
  definitions: [{ id: 'reviewer', name: 'Reviewer', description: 'Reviews a change.', persona: 'Be careful.' }],
  draft: null,
  pendingDelete: null,
  deleting: false,
}

function renderSection(
  state: Partial<SubagentsState> = {},
  delivery: {
    settlementBusy?: SubagentBusyDelivery
    reportBusy?: SubagentBusyDelivery
    jobBusy?: SubagentBusyDelivery
    writable?: boolean
  } = {},
) {
  const store = createSnapshotStore<SubagentsState>({ ...READY, ...state })
  const actions = {
    load: vi.fn(() => Promise.resolve()),
    beginCreate: vi.fn(),
    beginEdit: vi.fn(),
    cancelDraft: vi.fn(),
    setDraftName: vi.fn(),
    setDraftDescription: vi.fn(),
    setDraftPersona: vi.fn(),
    setDraftAllow: vi.fn(),
    setDraftDeny: vi.fn(),
    saveDraft: vi.fn(() => Promise.resolve()),
    confirmDelete: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
    setDelivery: vi.fn(),
  }
  render(<SubagentsSection {...({
    ...actions,
    useSubagents: bindSnapshotSelector(store),
    useSettlementBusy: bindSnapshotSelector(createSnapshotStore(delivery.settlementBusy ?? 'steer')),
    useReportBusy: bindSnapshotSelector(createSnapshotStore(delivery.reportBusy ?? 'steer')),
    useJobBusy: bindSnapshotSelector(createSnapshotStore(delivery.jobBusy ?? 'steer')),
    useDeliveryWritable: bindSnapshotSelector(createSnapshotStore(delivery.writable ?? true)),
    t: (key: keyof typeof en) => en[key],
    close: vi.fn(),
  } as unknown as SubagentsSectionProps)} />)
  return actions
}

describe('SubagentsSection', () => {
  it('loads on mount and offers the library', () => {
    const actions = renderSection()
    expect(actions.load).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Subagents' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Behavior' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Steer' })).toHaveLength(3)
  })

  it('keeps Behavior when the library namespace is unavailable', () => {
    const actions = renderSection({ status: 'unavailable', definitions: [] })
    expect(screen.getByRole('heading', { name: 'Behavior' })).toBeTruthy()
    expect(screen.getByText('This deployment does not expose subagent settings.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Steer' })[0]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Queue' }))
    expect(actions.setDelivery).toHaveBeenCalledWith(SETTLEMENT_BUSY_FIELD, 'queue')
  })

  it('ignores a delivery choice when the Host scope is read-only', () => {
    const actions = renderSection({}, { writable: false, settlementBusy: 'queue' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Queue' })[0]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Steer' }))
    expect(actions.setDelivery).not.toHaveBeenCalled()
  })

  it('closes an open delivery menu without writing', () => {
    renderSection()
    fireEvent.click(screen.getAllByRole('button', { name: 'Steer' })[0]!)
    expect(screen.getByRole('menuitem', { name: 'Queue' })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Queue' })).toBeNull()
  })

  it('writes independent delivery fields', () => {
    const actions = renderSection()
    fireEvent.click(screen.getAllByRole('button', { name: 'Steer' })[1]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Queue' }))
    expect(actions.setDelivery).toHaveBeenCalledWith(REPORT_BUSY_FIELD, 'queue')
    fireEvent.click(screen.getAllByRole('button', { name: 'Steer' })[2]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Queue' }))
    expect(actions.setDelivery).toHaveBeenCalledWith(JOB_BUSY_FIELD, 'queue')
    expect(screen.getByRole('button', { name: 'Edit: Reviewer' })).toBeTruthy()
    expect(screen.getByText('Reviews a change.')).toBeTruthy()
  })

  it('opens create and delete flows', () => {
    const actions = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'New subagent' }))
    expect(actions.beginCreate).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Reviewer' }))
    expect(actions.confirmDelete).toHaveBeenCalledWith('reviewer')
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Reviewer' }))
    expect(actions.beginEdit).toHaveBeenCalledWith('reviewer')
  })

  it('shows the unavailable and error states', () => {
    renderSection({ status: 'unavailable', definitions: [] })
    expect(screen.getByText('This deployment does not expose subagent settings.')).toBeTruthy()
    cleanup()
    const actions = renderSection({ status: 'error', error: 'down', definitions: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(actions.load).toHaveBeenCalled()
  })

  it('opens the draft and delete dialogs', () => {
    const actions = renderSection({
      draft: {
        id: null, name: 'Reviewer', description: '', persona: 'Be careful.',
        allow: '', deny: '', error: 'nameRequired', saving: false,
      },
      pendingDelete: 'reviewer',
    })
    fireEvent.change(screen.getByPlaceholderText('Shown in this list'), { target: { value: 'Voice' } })
    expect(actions.setDraftName).toHaveBeenCalledWith('Voice')
    fireEvent.change(screen.getByPlaceholderText('Shown to the model when it chooses a definition'), {
      target: { value: 'Reviews.' },
    })
    expect(actions.setDraftDescription).toHaveBeenCalledWith('Reviews.')
    fireEvent.change(screen.getByPlaceholderText('Role instructions that replace the deployment persona for this child'), {
      target: { value: 'Speak plainly.' },
    })
    expect(actions.setDraftPersona).toHaveBeenCalledWith('Speak plainly.')
    fireEvent.change(screen.getByPlaceholderText('Comma-separated global tool names to keep'), {
      target: { value: 'read' },
    })
    expect(actions.setDraftAllow).toHaveBeenCalledWith('read')
    fireEvent.change(screen.getByPlaceholderText('Comma-separated global tool names to hide'), {
      target: { value: 'edit' },
    })
    expect(actions.setDraftDeny).toHaveBeenCalledWith('edit')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(actions.saveDraft).toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]!)
    expect(actions.cancelDraft).toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!)
    expect(actions.cancelDraft).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(actions.remove).toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]!)
    expect(actions.confirmDelete).toHaveBeenCalledWith(null)
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]!)
    expect(actions.confirmDelete).toHaveBeenCalledTimes(2)
  })

  it('shows the empty library and a persona validation error', () => {
    renderSection({
      definitions: [],
      draft: {
        id: null, name: 'Reviewer', description: '', persona: '',
        allow: '', deny: '', error: 'personaRequired', saving: false,
      },
    })
    expect(screen.getByText('No subagent definitions yet. Create one for the model to choose.')).toBeTruthy()
    expect(screen.getByText('Write the persona text.')).toBeTruthy()
  })

  it('shows a page-level error beside an open draft', () => {
    renderSection({
      error: 'stale',
      draft: {
        id: 'reviewer', name: 'Reviewer', description: 'Reviews.', persona: 'Be careful.',
        allow: '', deny: '', error: null, saving: false,
      },
    })
    expect(screen.getByText('stale')).toBeTruthy()
  })

  it('shows an empty preview, read-only notice, and saving draft', () => {
    renderSection({
      writable: false,
      definitions: [{ id: 'plain', name: 'Plain', description: '', persona: 'Be quiet.' }],
      draft: {
        id: 'plain', name: 'Plain', description: '', persona: 'Be quiet.',
        allow: '', deny: '', error: 'conflict', saving: true,
      },
      deleting: true,
    })
    expect(screen.getByText('(empty)')).toBeTruthy()
    expect(screen.getByText('This deployment stores settings read-only.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    expect(screen.getByText('conflict')).toBeTruthy()
  })
})
