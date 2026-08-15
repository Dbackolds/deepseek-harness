/**
 * Host Automation sidebar occupant: the trigger under New Session plus the
 * modal that lists rules and creates one. The Host remains the fact source;
 * this component owns only panel visibility and the create draft.
 */

import { useEffect, useState, type ReactNode } from 'react'
import {
  Button, IconPlayOutline16, IconPlusOutline16, IconQueueOutline14, IconTrashOutline16,
  Input, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import {
  draftToCreate, EMPTY_DRAFT, formatNextAt, formatSelector, formatState, toggleWeekday,
  type AutomationDraft, type ScheduleKind,
} from './format.ts'
import { NS, type AutomationKey } from './locales.ts'
import type { AutomationRuleView, AutomationState, AutomationStore } from './store.ts'
import css from './AutomationPanel.module.css'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
const SCHEDULES: readonly ScheduleKind[] = ['after', 'at', 'every', 'clock']

/** Registration-side business face. */
export interface AutomationPanelInjected {
  hooks: {
    /** Page snapshot bound by the renderer as useAutomation. */
    automation: SnapshotStore<AutomationState>
  }
  /** Fetch the rule list when the panel first opens. */
  load: () => Promise<void>
  /** Persist one new rule. */
  create: AutomationStore['create']
  /** Enable or disable one rule. */
  setEnabled: AutomationStore['setEnabled']
  /** Fire one rule immediately. */
  runNow: AutomationStore['runNow']
  /** Delete one rule. */
  remove: AutomationStore['remove']
}

/** Full component props. */
export type AutomationPanelProps =
  PropsRuntime<'sidebar.automation'>
  & PropsLocale<typeof NS>
  & InjectFace<AutomationPanelInjected>

/**
 * Render the sidebar Automation trigger and panel.
 * @param props - composed slot props.
 * @returns the trigger, and the modal while it is open.
 */
export function AutomationPanel(props: AutomationPanelProps): ReactNode {
  const { wide, useAutomation, useWorkspaces, load, create, setEnabled, runNow, remove, t } = props
  const [open, setOpen] = useState(false)
  const state = useAutomation(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot.items)

  useEffect(() => {
    if (!open) return
    if (state.status === 'idle') void load()
  }, [open, state.status, load])

  return (
    <>
      <Tooltip label={t('trigger.label')} delayMs={500} disabled={wide}>
        <button
          type="button"
          className={wide ? css.trigger : `${css.trigger} ${css.rail}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('trigger.label')}
          onClick={() => { setOpen(true) }}
        >
          <IconQueueOutline14 size={wide ? 14 : 18} />
          {wide && <span className={css.label}>{t('trigger')}</span>}
        </button>
      </Tooltip>
      <Modal
        open={open}
        onClose={() => { setOpen(false) }}
        title={t('title')}
        closeLabel={t('close')}
        description={t('intro')}
      >
        <AutomationBody
          state={state}
          workspaces={workspaces}
          load={load}
          create={create}
          setEnabled={setEnabled}
          runNow={runNow}
          remove={remove}
          t={t}
        />
      </Modal>
    </>
  )
}

interface BodyProps {
  state: AutomationState
  workspaces: readonly WorkspaceView[]
  load: () => Promise<void>
  create: AutomationStore['create']
  setEnabled: AutomationStore['setEnabled']
  runNow: AutomationStore['runNow']
  remove: AutomationStore['remove']
  t: AutomationPanelProps['t']
}

function AutomationBody({
  state, workspaces, load, create, setEnabled, runNow, remove, t,
}: BodyProps): ReactNode {
  const [adding, setAdding] = useState(false)
  if (state.status === 'error' && state.items.length === 0) {
    return (
      <div className={css.section}>
        <p className={css.error}>{t('loadFailed') + ': ' + String(state.error)}</p>
        <Button variant="outline" onClick={() => { void load() }}>{t('retry')}</Button>
      </div>
    )
  }
  return (
    <div className={css.section}>
      {state.error !== null && <p className={css.notice} role="alert">{state.error}</p>}
      {state.items.length === 0 && !adding
        ? <p className={css.empty}>{t('empty')}</p>
        : (
          <ul className={css.rows}>
            {state.items.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                workspaceTitle={workspaces.find(item => item.workspaceId === rule.workspaceId)?.title}
                setEnabled={setEnabled}
                runNow={runNow}
                remove={remove}
                t={t}
              />
            ))}
          </ul>
        )}
      {adding
        ? (
          <CreateForm
            workspaces={workspaces}
            create={create}
            onClose={() => { setAdding(false) }}
            t={t}
          />
        )
        : (
          <Button
            variant="outline"
            icon={<IconPlusOutline16 size={16} />}
            onClick={() => { setAdding(true) }}
          >
            {t('add')}
          </Button>
        )}
    </div>
  )
}

function RuleRow({
  rule, workspaceTitle, setEnabled, runNow, remove, t,
}: {
  rule: AutomationRuleView
  workspaceTitle: string | undefined
  setEnabled: AutomationStore['setEnabled']
  runNow: AutomationStore['runNow']
  remove: AutomationStore['remove']
  t: AutomationPanelProps['t']
}): ReactNode {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [rowError, setRowError] = useState<string | undefined>(undefined)
  const run = (work: () => Promise<string | undefined>): void => {
    /* v8 ignore next -- the action buttons disable while a mutation is in flight */
    if (busy) return
    setBusy(true)
    setRowError(undefined)
    void work()
      .then((failure) => { if (failure !== undefined) setRowError(failure) })
      .finally(() => { setBusy(false) })
  }
  const meta = [
    formatState(rule.state, t),
    formatSelector(rule.selector, t),
    t('next', { when: formatNextAt(rule.nextAt) }),
    ...workspaceTitle === undefined ? [] : [workspaceTitle],
  ].join(' · ')
  return (
    <li className={css.rowCard}>
      <div className={css.rowHead}>
        <div className={css.rowIdentity}>
          <div className={css.rowName}>{rule.name}</div>
          <div className={css.rowMeta}>{meta}</div>
          <div className={css.rowTask}>{rule.task}</div>
        </div>
        <div className={css.rowActions}>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => { run(() => setEnabled(rule.id, !rule.enabled)) }}
          >
            {rule.enabled ? t('disabled') : t('enabled')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<IconPlayOutline16 size={14} />}
            disabled={busy}
            onClick={() => { run(() => runNow(rule.id)) }}
          >
            {t('runNow')}
          </Button>
          <Button
            size="sm"
            icon={<IconTrashOutline16 size={14} />}
            disabled={busy}
            onClick={() => { setConfirming(true) }}
          >
            {t('delete')}
          </Button>
        </div>
      </div>
      {rowError !== undefined && <p className={css.error} role="alert">{rowError}</p>}
      <Modal
        open={confirming}
        onClose={() => { setConfirming(false) }}
        title={t('delete.title')}
        closeLabel={t('close')}
        description={t('delete.description')}
        footer={(
          <>
            <Button variant="ghost" disabled={busy} onClick={() => { setConfirming(false) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                run(async () => {
                  const failure = await remove(rule.id)
                  if (failure === undefined) setConfirming(false)
                  return failure
                })
              }}
            >
              {busy ? t('deleting') : t('delete.confirm')}
            </Button>
          </>
        )}
      />
    </li>
  )
}

function CreateForm({
  workspaces, create, onClose, t,
}: {
  workspaces: readonly WorkspaceView[]
  create: AutomationStore['create']
  onClose: () => void
  t: AutomationPanelProps['t']
}): ReactNode {
  const [draft, setDraft] = useState<AutomationDraft>(() => ({
    ...EMPTY_DRAFT,
    workspaceId: workspaces[0]?.workspaceId ?? '',
    /* v8 ignore next -- browsers always resolve a timeZone string */
    clockZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const patch = (next: Partial<AutomationDraft>): void => {
    setDraft(current => ({ ...current, ...next }))
  }
  const submit = (): void => {
    const parsed = draftToCreate(draft, t)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError(undefined)
    void create(parsed.input)
      .then((failure) => {
        if (failure !== undefined) {
          setError(failure)
          return
        }
        onClose()
      })
      .finally(() => { setBusy(false) })
  }
  return (
    <form
      className={css.form}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('name')}</span>
        <Input
          value={draft.name}
          placeholder={t('name.placeholder')}
          onChange={(event) => { patch({ name: event.target.value }) }}
        />
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('task')}</span>
        <textarea
          className={css.textarea}
          value={draft.task}
          placeholder={t('task.placeholder')}
          required
          onChange={(event) => { patch({ task: event.target.value }) }}
        />
      </label>
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('workspace')}</span>
        {workspaces.length === 0
          ? <p className={css.notice}>{t('workspace.empty')}</p>
          : (
            <select
              className={css.select}
              value={draft.workspaceId}
              onChange={(event) => { patch({ workspaceId: event.target.value }) }}
            >
              {workspaces.map(workspace => (
                <option key={workspace.workspaceId} value={workspace.workspaceId}>
                  {workspace.title}
                </option>
              ))}
            </select>
          )}
      </label>
      <fieldset className={css.field}>
        <legend className={css.fieldLabel}>{t('schedule')}</legend>
        <div className={css.schedule}>
          {SCHEDULES.map((kind) => {
            const key = ('schedule.' + kind) as AutomationKey
            return (
              <Button
                key={kind}
                size="sm"
                variant={draft.schedule === kind ? 'primary' : 'outline'}
                aria-pressed={draft.schedule === kind}
                onClick={() => { patch({ schedule: kind }) }}
              >
                {t(key)}
              </Button>
            )
          })}
        </div>
      </fieldset>
      {draft.schedule === 'after' && (
        <label className={css.field}>
          <span className={css.fieldLabel}>{t('after.seconds')}</span>
          <Input
            type="number"
            min={1}
            step={1}
            value={draft.afterSeconds}
            onChange={(event) => { patch({ afterSeconds: event.target.value }) }}
          />
        </label>
      )}
      {draft.schedule === 'at' && (
        <label className={css.field}>
          <span className={css.fieldLabel}>{t('at.instant')}</span>
          <Input
            value={draft.at}
            placeholder="2026-08-16T09:00:00.000Z"
            onChange={(event) => { patch({ at: event.target.value }) }}
          />
        </label>
      )}
      {draft.schedule === 'every' && (
        <label className={css.field}>
          <span className={css.fieldLabel}>{t('every.seconds')}</span>
          <Input
            type="number"
            min={300}
            step={1}
            value={draft.everySeconds}
            onChange={(event) => { patch({ everySeconds: event.target.value }) }}
          />
        </label>
      )}
      {draft.schedule === 'clock' && (
        <>
          <label className={css.field}>
            <span className={css.fieldLabel}>{t('clock.time')}</span>
            <Input
              type="time"
              value={draft.clockTime}
              onChange={(event) => { patch({ clockTime: event.target.value }) }}
            />
          </label>
          <label className={css.field}>
            <span className={css.fieldLabel}>{t('clock.zone')}</span>
            <Input
              aria-label={t('clock.zone')}
              value={draft.clockZone}
              onChange={(event) => { patch({ clockZone: event.target.value }) }}
            />
          </label>
          <fieldset className={css.field}>
            <legend className={css.fieldLabel}>{t('clock.weekdays')}</legend>
            <div className={css.weekdays}>
              {WEEKDAYS.map((day) => {
                const key = ('weekday.' + String(day)) as AutomationKey
                const pressed = draft.weekdays.includes(day)
                return (
                  <Button
                    key={day}
                    size="sm"
                    variant={pressed ? 'primary' : 'outline'}
                    aria-pressed={pressed}
                    onClick={() => { patch({ weekdays: toggleWeekday(draft.weekdays, day) }) }}
                  >
                    {t(key)}
                  </Button>
                )
              })}
            </div>
          </fieldset>
        </>
      )}
      <label className={css.field}>
        <span className={css.fieldLabel}>{t('overlap')}</span>
        <select
          className={css.select}
          value={draft.onOverlap}
          onChange={(event) => { patch({ onOverlap: event.target.value === 'replace' ? 'replace' : 'skip' }) }}
        >
          <option value="skip">{t('overlap.skip')}</option>
          <option value="replace">{t('overlap.replace')}</option>
        </select>
      </label>
      {error !== undefined && <p className={css.error} role="alert">{error}</p>}
      <div className={css.formActions}>
        <Button variant="ghost" disabled={busy} onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" disabled={busy || workspaces.length === 0} onClick={submit}>
          {busy ? t('creating') : t('create')}
        </Button>
      </div>
    </form>
  )
}
