/**
 * The Git branch chip on the new-session screen, beside the workspace
 * picker and agent-preset chip.
 *
 * Each session keeps its own overlay: picking a branch other than the
 * workspace HEAD creates or reuses a linked worktree for that session.
 * A workspace that is not a Git checkout hides the chip.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Button, IconBranchOutline16, IconChevronDownOutline14, Input, Menu, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the hero seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { GitBranchSeatState } from './seat-store.ts'
import css from './GitBranchSeat.module.css'

/** Registration-side business face for the hero chip. */
export interface GitBranchSeatInjected {
  hooks: {
    /** Seat snapshot bound by the renderer as useGitBranchSeat. */
    gitBranchSeat: SnapshotStore<GitBranchSeatState>
  }
  /** Read the current session overlay when the chip first renders. */
  load: () => Promise<void>
  /** Check one existing branch out for the current session. */
  checkout: (branch: string) => Promise<void>
  /** Create a new local branch and check it out. */
  createBranch: (branch: string) => Promise<void>
}

/** Full component props. */
export type GitBranchSeatProps =
  PropsRuntime<'conversation.hero.branch'>
  & PropsLocale<'gitBranch'>
  & InjectFace<GitBranchSeatInjected>

/**
 * Render the new-session Git branch chip.
 * @param props - composed slot props.
 * @returns the chip, or null when the current workspace is not a Git checkout.
 */
export function GitBranchSeat({
  useWorkspaces, load, checkout, createBranch, useGitBranchSeat, t,
}: GitBranchSeatProps) {
  const state = useGitBranchSeat(snapshot => snapshot)
  const recentWorkspaceId = useWorkspaces(s => s.recentWorkspaceId)
  const workspaceCount = useWorkspaces(s => s.items.length)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    void load()
  }, [load, recentWorkspaceId, workspaceCount])

  if (state.unavailable || state.view === null) return null

  const local = state.view.branches.filter(branch => !branch.remote)
  const remote = state.view.branches.filter(branch => branch.remote)
  const items: MenuEntry[] = []
  if (local.length > 0) {
    items.push({ type: 'label', id: 'local', text: t('menu.local') })
    for (const branch of local) items.push({ id: branch.name, label: branch.name })
  }
  if (remote.length > 0) {
    items.push({ type: 'separator', id: 'remote-sep' })
    items.push({ type: 'label', id: 'remote', text: t('menu.remote') })
    for (const branch of remote) items.push({ id: branch.name, label: branch.name })
  }
  items.push({ type: 'separator', id: 'create-sep' })
  items.push({ id: '__create__', label: t('menu.create') })

  return (
    <>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={items}
        selectedId={state.view.currentBranch}
        onSelect={(id) => {
          setOpen(false)
          if (id === '__create__') {
            setDraft('')
            setCreating(true)
            return
          }
          void checkout(id)
        }}
        align="start"
        portal
        anchor={(
          <button
            type="button"
            className={css.seat}
            aria-haspopup="menu"
            aria-expanded={open}
            title={state.error ?? t('seat.hint')}
            disabled={state.busy}
            onClick={() => { setOpen(value => !value) }}
          >
            <IconBranchOutline16 className={css.seatIcon} />
            {state.view.currentBranch}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
      <Modal
        open={creating}
        onClose={() => { setCreating(false) }}
        title={t('create.title')}
        closeLabel={t('create.close')}
        footer={(
          <>
            <Button size="sm" onClick={() => { setCreating(false) }}>{t('create.cancel')}</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={draft.trim().length === 0 || state.busy}
              onClick={() => {
                setCreating(false)
                void createBranch(draft.trim())
              }}
            >
              {t('create.confirm')}
            </Button>
          </>
        )}
      >
        <label className={css.createField}>
          <span>{t('create.name')}</span>
          <Input
            value={draft}
            placeholder={t('create.placeholder')}
            autoFocus
            onChange={(event) => { setDraft(event.target.value) }}
          />
        </label>
      </Modal>
    </>
  )
}
