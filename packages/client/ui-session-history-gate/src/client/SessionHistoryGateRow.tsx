/** General Settings row for the session-history tools gate. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionHistoryGateKey } from './locales.ts'
import css from './SessionHistoryGateRow.module.css'

/** Registration-side gate preference face. */
export interface SessionHistoryGateRowInjected {
  hooks: {
    /** Persisted gate state bound as useEnabled. */
    enabled: SnapshotStore<boolean>
    /** Whether the settings document accepts writes, bound as useWritable. */
    writable: SnapshotStore<boolean>
    /** Whether a toggle write is settling, bound as useSaving. */
    saving: SnapshotStore<boolean>
  }
  /** Change the gate state; optimistic with revert on write failure. */
  setEnabled: (enabled: boolean) => void
}

/** Full Settings-row props. */
export type SessionHistoryGateRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.session-history-gate'>
  & InjectFace<SessionHistoryGateRowInjected>

/**
 * Render the session-history tools gate row.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function SessionHistoryGateRow({
  useEnabled,
  useWritable,
  useSaving,
  setEnabled,
  t,
}: SessionHistoryGateRowProps) {
  const enabled = useEnabled(value => value)
  const writable = useWritable(value => value)
  const saving = useSaving(value => value)

  return (
    <div className={css.row} aria-busy={saving || undefined}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
      </div>
      <input
        type="checkbox"
        className={css.checkbox}
        aria-label={t('title')}
        checked={enabled}
        disabled={!writable}
        onChange={(event) => { setEnabled(event.target.checked) }}
      />
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The session-history tools gate row's copy. */
    'settings.session-history-gate': SessionHistoryGateKey
  }
}
