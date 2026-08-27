/** General Settings row for client-plugin hot reload. */
import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ReloadRow.module.css'

/** Registration-side preference face. */
export interface ReloadRowInjected {
  hooks: {
    /** Persisted automatic-reload preference bound as useAutoReload. */
    autoReload: SnapshotStore<boolean>
  }
  /** Change whether rebuilt bundles reload without a refresh. */
  setAutoReload: (enabled: boolean) => void
  /** Re-hash watched bundles and reload every client plugin. */
  reloadPlugins: () => Promise<number>
}

/** Full Settings-row props. */
export type ReloadRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.hmr'>
  & InjectFace<ReloadRowInjected>

type ReloadStatus =
  | { kind: 'idle' }
  | { kind: 'reloading' }
  | { kind: 'reloaded'; count: number }
  | { kind: 'failed' }

/**
 * Render the plugin hot-reload preference row.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function ReloadRow({
  useAutoReload, setAutoReload, reloadPlugins, t,
}: ReloadRowProps) {
  const autoReload = useAutoReload(value => value)
  const [status, setStatus] = useState<ReloadStatus>({ kind: 'idle' })

  const statusText = status.kind === 'reloading' ? t('reloading')
    : status.kind === 'reloaded' ? t('reloaded', { count: status.count })
      : status.kind === 'failed' ? t('reloadFailed')
        : undefined

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
      </div>
      <div className={css.controls}>
        {statusText !== undefined && <div className={css.status}>{statusText}</div>}
        <button
          type="button"
          className={css.switch}
          role="switch"
          aria-checked={autoReload}
          onClick={() => { setAutoReload(!autoReload) }}
        >
          <span>{t('autoReload')}</span>
          <span className={css.track} data-on={autoReload || undefined} aria-hidden="true">
            <span className={css.thumb} />
          </span>
        </button>
        <Button
          variant="outline"
          size="sm"
          disabled={status.kind === 'reloading'}
          onClick={() => {
            setStatus({ kind: 'reloading' })
            void reloadPlugins().then(
              (count) => { setStatus({ kind: 'reloaded', count }) },
              () => { setStatus({ kind: 'failed' }) },
            )
          }}
        >
          {t('reload')}
        </Button>
      </div>
    </div>
  )
}
