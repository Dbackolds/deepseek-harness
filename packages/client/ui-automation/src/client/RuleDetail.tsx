/** Selected-rule settings and history panes. */
import { useState, type ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
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
  tab: AutomationState['detailTab']
  update: AutomationStore['update']
  setEnabled: AutomationStore['setEnabled']
  runNow: AutomationStore['runNow']
  openRun: AutomationStore['openRun']
  remove: AutomationStore['remove']
  select: AutomationStore['select']
  setDetailTab: AutomationStore['setDetailTab']
  t: AutomationPanelProps['t']
}): ReactNode {
  const { item, workspaces, tab, update, setEnabled, runNow, openRun, remove, select, setDetailTab, t } = props
  const { rule } = item
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const running = item.lastSessionId !== undefined
    && item.runs?.some(run => run.outcome === 'started' && run.sessionId === item.lastSessionId) === true
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
        {tab === 'settings' ? (
          <div className={css.detailActions}>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { act(() => runNow(rule.id)) }}>{t('runNow')}</Button>
            <div className={css.moreWrap}>
              <Button size="sm" variant="outline" aria-label={t('more')} onClick={() => { setMenuOpen(open => !open) }}>...</Button>
              {menuOpen ? (
                <div className={css.menu} role="menu">
                  <button type="button" role="menuitem" className={css.menuItem} disabled={busy} onClick={() => { setMenuOpen(false); act(() => setEnabled(rule.id, !rule.enabled)) }}>
                    {rule.enabled ? t('pause') : t('enabled')}
                  </button>
                  <button type="button" role="menuitem" className={css.menuDanger} disabled={busy} onClick={() => { setMenuOpen(false); setConfirming(true) }}>
                    {t('delete')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}
      {tab === 'settings'
        ? <SettingsPane item={item} workspaces={workspaces} running={running} update={update} t={t} />
        : <HistoryPane runs={item.runs ?? []} openRun={openRun} t={t} />}
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
      <div className={css.statusRow}>
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

function HistoryPane({ runs, openRun, t }: {
  runs: readonly AutomationRunView[]
  openRun: AutomationStore['openRun']
  t: AutomationPanelProps['t']
}): ReactNode {
  const [openId, setOpenId] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
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
            const outcomeKey = ('history.outcome.' + run.outcome) as AutomationKey
            return (
              <tr key={run.id}>
                <td>{formatNextAt(run.startedAt)}</td>
                <td>{t('history.source.schedule')}</td>
                <td><span className={outcomeClass(run.outcome)}>{t(outcomeKey)}</span></td>
                <td>{runDuration(run, runs)}</td>
                <td className={css.historyMenuCell}>
                  <Button size="sm" variant="ghost" aria-label={t('more')} onClick={() => { setOpenId(openId === run.id ? undefined : run.id) }}>...</Button>
                  {openId === run.id ? (
                    <div className={css.menu} role="menu">
                      <button type="button" role="menuitem" className={css.menuItem} disabled={run.sessionId === undefined} onClick={() => {
                        setOpenId(undefined)
                        if (run.sessionId === undefined) {
                          setNotice(t('history.missing'))
                          return
                        }
                        void openRun(run.sessionId).then((failure) => {
                          if (failure !== undefined) setNotice(localizeRunFailure(failure, t))
                        })
                      }}>{t('history.open')}</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function outcomeClass(outcome: AutomationRunView['outcome']): string {
  switch (outcome) {
    case 'started': return css.outcomeOk ?? ''
    case 'skipped_busy':
    case 'replaced': return css.outcomeSkip ?? ''
    case 'failed': return css.outcomeFail ?? ''
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

function runDuration(run: AutomationRunView, runs: readonly AutomationRunView[]): string {
  if (run.outcome === 'skipped_busy') return '0s'
  const index = runs.findIndex(item => item.id === run.id)
  const newer = index > 0 ? runs[index - 1] : undefined
  const end = newer === undefined ? Date.now() : Date.parse(newer.startedAt)
  const start = Date.parse(run.startedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '-'
  const seconds = Math.round((end - start) / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes === 0 ? rest + 's' : minutes + 'm ' + rest + 's'
}
