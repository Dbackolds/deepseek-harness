/** Selected-rule settings and history panes. */
import { useEffect, useState, type ReactNode } from 'react'
import { Button, Menu, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { draftToUpdate, formatNextAt, ruleToDraft, type AutomationDraft } from './format.ts'
import type { AutomationKey } from './locales.ts'
import type { AutomationListedRule, AutomationRunView, AutomationState, AutomationStore } from './store.ts'
import type { AutomationPanelProps } from './AutomationPanel.tsx'
import { CreateForm } from './AutomationPanel.tsx'
import css from './AutomationPanel.module.css'

function localizeRunFailure(failure: string, t: AutomationPanelProps['t']): string {
  switch (failure) {
    case 'skipped_busy': return t('runNow.skipped')
    case 'max_concurrent_runs': return t('runNow.maxConcurrent')
    case 'failed': return t('runNow.failed')
    case 'missing_session': return t('runNow.missingSession')
    default: return failure
  }
}

/** Render one rule's settings or history pane. */
export function RuleDetail(props: {
  item: AutomationListedRule
  workspaces: readonly WorkspaceView[]
  useSessions: AutomationPanelProps['useSessions']
  tab: AutomationState['detailTab']
  update: AutomationStore['update']
  setEnabled: AutomationStore['setEnabled']
  runNow: AutomationStore['runNow']
  openRun: AutomationStore['openRun']
  deleteRun: AutomationStore['deleteRun']
  remove: AutomationStore['remove']
  select: AutomationStore['select']
  setDetailTab: AutomationStore['setDetailTab']
  t: AutomationPanelProps['t']
}): ReactNode {
  const { item, workspaces, useSessions, tab, update, setEnabled, runNow, openRun, deleteRun, remove, select, setDetailTab, t } = props
  const { rule } = item
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const runningIds = useSessions(snapshot => new Set(
    Object.values(snapshot.byId).filter(session => session.running === true).map(session => session.id),
  ))
  const running = item.lastSessionId !== undefined && runningIds.has(item.lastSessionId)
  const act = (work: () => Promise<string | undefined>): void => {
    if (busy) return
    setBusy(true)
    setNotice(undefined)
    void work()
      .then((failure) => { if (failure !== undefined) setNotice(localizeRunFailure(failure, t)) })
      .finally(() => { setBusy(false) })
  }
  return (
    <div className={css.detail}>
      <button type="button" className={css.back} onClick={() => { select(null) }}>
        {'← '}{rule.name}
      </button>
      <div className={css.detailToolbar}>
        <div className={css.tabs} role="tablist" aria-label={t('title')}>
          <button type="button" role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? css.tabActive : css.tab} onClick={() => { setDetailTab('settings') }}>
            {t('tab.settings')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? css.tabActive : css.tab} onClick={() => { setDetailTab('history') }}>
            {t('tab.history')}
          </button>
        </div>
        <div className={css.detailActions}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => { act(() => runNow(rule.id)) }}>{t('runNow')}</Button>
          <Menu
            open={menuOpen}
            portal
            align="end"
            onClose={() => { setMenuOpen(false) }}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'pause') act(() => setEnabled(rule.id, !rule.enabled))
              if (id === 'delete') setConfirming(true)
            }}
            items={[
              { id: 'pause', label: rule.enabled ? t('pause') : t('enabled'), disabled: busy },
              { id: 'delete', label: t('delete'), danger: true, disabled: busy },
            ]}
            anchor={(
              <Button size="sm" variant="outline" aria-label={t('more')} onClick={() => { setMenuOpen(open => !open) }}>
                ...
              </Button>
            )}
          />
        </div>
      </div>
      {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}
      {tab === 'settings'
        ? <SettingsPane item={item} workspaces={workspaces} running={running} update={update} t={t} />
        : <HistoryPane runs={item.runs ?? []} runningIds={runningIds} openRun={openRun} deleteRun={deleteRun} t={t} />}
      <Modal open={confirming} onClose={() => { setConfirming(false) }} title={t('delete.title')} closeLabel={t('close')} description={t('delete.description')} footer={(
        <>
          <Button variant="ghost" disabled={busy} onClick={() => { setConfirming(false) }}>{t('cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => { act(async () => { const failure = await remove(rule.id); if (failure === undefined) setConfirming(false); return failure }) }}>
            {busy ? t('deleting') : t('delete.confirm')}
          </Button>
        </>
      )} />
    </div>
  )
}

function SettingsPane({ item, workspaces, running, update, t }: {
  item: AutomationListedRule
  workspaces: readonly WorkspaceView[]
  running: boolean
  update: AutomationStore['update']
  t: AutomationPanelProps['t']
}): ReactNode {
  const fallbackZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const [draft, setDraft] = useState<AutomationDraft>(() => ruleToDraft(item.rule, fallbackZone))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const patch = (next: Partial<AutomationDraft>): void => {
    setSaved(false)
    setDraft(current => ({ ...current, ...next }))
  }
  const submit = (): void => {
    const parsed = draftToUpdate(draft, t)
    if (!parsed.ok) { setError(parsed.error); return }
    setBusy(true)
    setError(undefined)
    void update(item.rule.id, parsed.input).then((failure) => {
      if (failure !== undefined) { setError(failure); return }
      setSaved(true)
    }).finally(() => { setBusy(false) })
  }
  return (
    <div className={css.settings}>
      <div className={css.statusChip} data-running={running ? 'true' : 'false'}>
        <span className={css.fieldLabel}>{t('status')}</span>
        <span className={running ? css.statusOn : css.statusOff}>{running ? t('status.running') : t('status.idle')}</span>
      </div>
      <CreateForm
        workspaces={workspaces}
        seed={undefined}
        initial={draft}
        submitLabel={busy ? t('saving') : t('save')}
        create={async () => undefined}
        onPatch={patch}
        onSave={submit}
        onClose={() => undefined}
        hideCancel
        t={t}
      />
      {error !== undefined && <p className={css.error} role="alert">{error}</p>}
      {saved && error === undefined ? <p className={css.notice}>{t('saved')}</p> : null}
    </div>
  )
}

const LIVE_DURATION_MS = 950

function HistoryPane({ runs, runningIds, openRun, deleteRun, t }: {
  runs: readonly AutomationRunView[]
  runningIds: ReadonlySet<string>
  openRun: AutomationStore['openRun']
  deleteRun: AutomationStore['deleteRun']
  t: AutomationPanelProps['t']
}): ReactNode {
  const [openId, setOpenId] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [now, setNow] = useState(() => Date.now())
  const live = runs.some(run => historyStatus(run, runningIds) === 'running')
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => { setNow(Date.now()) }, LIVE_DURATION_MS)
    return () => { window.clearInterval(timer) }
  }, [live])
  if (runs.length === 0) return <p className={css.emptyHint}>{t('history.empty')}</p>
  return (
    <div className={css.history}>
      {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}
      <table className={css.table}>
        <thead>
          <tr>
            <th>{t('history.startedAt')}</th>
            <th>{t('history.source')}</th>
            <th>{t('history.status')}</th>
            <th>{t('history.duration')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const status = historyStatus(run, runningIds)
            return (
              <tr key={run.id}>
                <td>{formatNextAt(run.startedAt)}</td>
                <td>{t(run.source === 'manual' ? 'history.source.manual' : 'history.source.schedule')}</td>
                <td><span className={statusClass(status)}>{t(statusKey(status))}</span></td>
                <td className={css.historyDuration}>{runDuration(run, now, status)}</td>
                <td className={css.historyMenuCell}>
                  <Menu
                    open={openId === run.id}
                    portal
                    align="end"
                    onClose={() => { setOpenId(undefined) }}
                    onSelect={(id) => {
                      setOpenId(undefined)
                      if (id === 'open') {
                        if (run.sessionId === undefined) {
                          setNotice(t('history.missing'))
                          return
                        }
                        void openRun(run.sessionId).then((failure) => {
                          if (failure !== undefined) setNotice(localizeRunFailure(failure, t))
                        })
                        return
                      }
                      void deleteRun(run.id).then((failure) => {
                        if (failure !== undefined) setNotice(failure)
                      })
                    }}
                    items={[
                      { id: 'open', label: t('history.open'), disabled: run.sessionId === undefined },
                      { id: 'delete', label: t('history.delete'), danger: true },
                    ]}
                    anchor={(
                      <Button size="sm" variant="ghost" aria-label={t('more')} onClick={() => { setOpenId(openId === run.id ? undefined : run.id) }}>
                        ...
                      </Button>
                    )}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type HistoryStatus = AutomationRunView['outcome'] | 'running'

function historyStatus(run: AutomationRunView, runningIds: ReadonlySet<string>): HistoryStatus {
  if (run.outcome !== 'started') return run.outcome
  if (run.endedAt !== undefined) return 'started'
  return run.sessionId !== undefined && runningIds.has(run.sessionId) ? 'running' : 'started'
}

function statusKey(status: HistoryStatus): AutomationKey {
  return ('history.outcome.' + status) as AutomationKey
}

function statusClass(status: HistoryStatus): string {
  switch (status) {
    case 'running': return css.outcomeRun ?? ''
    case 'started': return css.outcomeOk ?? ''
    case 'skipped_busy':
    case 'replaced': return css.outcomeSkip ?? ''
    case 'failed': return css.outcomeFail ?? ''
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function runDuration(run: AutomationRunView, now: number, status: HistoryStatus): string {
  if (run.outcome === 'skipped_busy') return '0s'
  const start = Date.parse(run.startedAt)
  if (!Number.isFinite(start)) return '-'
  const end = run.endedAt === undefined
    ? (status === 'running' ? now : undefined)
    : Date.parse(run.endedAt)
  if (end === undefined || !Number.isFinite(end) || end < start) return '-'
  return formatDurationMs(end - start)
}

function formatDurationMs(elapsed: number): string {
  const seconds = Math.max(0, Math.floor(elapsed / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return hours + 'h ' + minutes + 'm ' + rest + 's'
  if (minutes > 0) return minutes + 'm ' + rest + 's'
  return rest + 's'
}
