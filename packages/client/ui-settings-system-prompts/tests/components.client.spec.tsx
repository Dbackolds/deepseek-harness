// @vitest-environment jsdom
/** Section behavior over a driven snapshot store. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { SystemPromptsSection } from '../src/client/SystemPromptsSection.tsx'
import type { SystemPromptsSectionProps } from '../src/client/SystemPromptsSection.tsx'
import type { SystemPromptsState } from '../src/client/store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const READY: SystemPromptsState = {
  status: 'ready',
  error: null,
  catalogError: null,
  writable: true,
  revision: 1,
  prompts: [{ id: 'style', name: 'Style', text: 'Be concise.' }],
  bindings: [],
  catalog: [{
    provider: 'deepseek-official',
    providerName: 'DeepSeek',
    model: 'deepseek-v4-flash',
    modelName: 'DeepSeek V4 Flash',
  }],
  draft: null,
  pendingDelete: null,
  deleting: false,
}

function renderSection(state: Partial<SystemPromptsState> = {}) {
  const store = createSnapshotStore<SystemPromptsState>({ ...READY, ...state })
  const actions = {
    load: vi.fn(() => Promise.resolve()),
    beginCreate: vi.fn(),
    beginEdit: vi.fn(),
    cancelDraft: vi.fn(),
    setDraftName: vi.fn(),
    setDraftText: vi.fn(),
    saveDraft: vi.fn(() => Promise.resolve()),
    confirmDelete: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
    setPromptIds: vi.fn(() => Promise.resolve()),
    setOverride: vi.fn(() => Promise.resolve()),
  }
  render(<SystemPromptsSection {...({
    ...actions,
    useSystemPrompts: bindSnapshotSelector(store),
    t: (key: keyof typeof en) => en[key],
    close: vi.fn(),
  } as unknown as SystemPromptsSectionProps)} />)
  return actions
}

describe('SystemPromptsSection', () => {
  it('loads on mount and offers the library plus one model card', () => {
    const actions = renderSection()
    expect(actions.load).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'System prompts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit: Style' })).toBeTruthy()
    expect(screen.getByText('DeepSeek V4 Flash')).toBeTruthy()
  })

  it('opens a create draft from the dashed add control', () => {
    const actions = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'New system prompt' }))
    expect(actions.beginCreate).toHaveBeenCalled()
  })

  it('adds a library prompt to the selected model', () => {
    const actions = renderSection()
    fireEvent.change(screen.getByLabelText('Add to this model'), { target: { value: 'style' } })
    expect(actions.setPromptIds).toHaveBeenCalledWith(
      'deepseek-official',
      'deepseek-v4-flash',
      ['style'],
    )
  })

  it('toggles override for the selected model', () => {
    const actions = renderSection()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Override assembled prompt' }))
    expect(actions.setOverride).toHaveBeenCalledWith('deepseek-official', 'deepseek-v4-flash', true)
  })

  it('reorders a selected prompt', () => {
    const actions = renderSection({
      prompts: [
        { id: 'style', name: 'Style', text: 'Be concise.' },
        { id: 'rules', name: 'Rules', text: 'Never guess.' },
      ],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style', 'rules'],
        override: false,
      }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move up: Rules' }))
    expect(actions.setPromptIds).toHaveBeenCalledWith(
      'deepseek-official',
      'deepseek-v4-flash',
      ['rules', 'style'],
    )
  })

  it('asks before deleting a library prompt', () => {
    const actions = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Delete: Style' }))
    expect(actions.confirmDelete).toHaveBeenCalledWith('style')
  })

  it('opens the draft and delete dialogs', () => {
    const actions = renderSection({
      draft: { id: null, name: 'Style', text: 'Be concise.', error: 'nameRequired', saving: false },
    })
    fireEvent.change(screen.getByPlaceholderText('Shown in this list'), { target: { value: 'Voice' } })
    expect(actions.setDraftName).toHaveBeenCalledWith('Voice')
    fireEvent.change(screen.getByPlaceholderText('Text the model reads as a system-prompt section'), {
      target: { value: 'Speak plainly.' },
    })
    expect(actions.setDraftText).toHaveBeenCalledWith('Speak plainly.')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(actions.saveDraft).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(actions.cancelDraft).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(actions.cancelDraft).toHaveBeenCalledTimes(2)
    cleanup()
    const deleteActions = renderSection({ pendingDelete: 'style' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteActions.remove).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteActions.confirmDelete).toHaveBeenCalledWith(null)
  })

  it('opens an existing prompt for edit', () => {
    const actions = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Style' }))
    expect(actions.beginEdit).toHaveBeenCalledWith('style')
  })

  it('renders empty library, catalog failure, and a saving edit draft', () => {
    renderSection({
      prompts: [],
      catalog: [],
      catalogError: 'down',
      writable: false,
    })
    expect(screen.getByText('No system prompts yet. Create one to assemble it onto a model.')).toBeTruthy()
    expect(screen.getByText('Could not load the model catalog. The library is still editable.')).toBeTruthy()
    expect(screen.getByText('This deployment stores settings read-only.')).toBeTruthy()
    cleanup()
    renderSection({
      draft: { id: 'style', name: 'Style', text: 'Be concise.', error: null, saving: true },
    })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
  })

  it('renders unavailable and error states', () => {
    renderSection({ status: 'unavailable', writable: false, prompts: [], catalog: [] })
    expect(screen.getByText('This deployment does not expose system-prompt settings.')).toBeTruthy()
    cleanup()
    const actions = renderSection({ status: 'error', error: 'boom', prompts: [], catalog: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(actions.load).toHaveBeenCalled()
  })

  it('moves a selected prompt down and removes it', () => {
    const actions = renderSection({
      prompts: [
        { id: 'style', name: 'Style', text: 'Be concise.' },
        { id: 'rules', name: 'Rules', text: 'Never guess.' },
      ],
      bindings: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        promptIds: ['style', 'rules'],
        override: true,
      }],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Style' }))
    expect(actions.setPromptIds).toHaveBeenCalledWith(
      'deepseek-official',
      'deepseek-v4-flash',
      ['rules', 'style'],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove from this model: Style' }))
    expect(actions.setPromptIds).toHaveBeenLastCalledWith(
      'deepseek-official',
      'deepseek-v4-flash',
      ['rules'],
    )
  })
})
