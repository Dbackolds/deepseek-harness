/** General Settings row for product-update checks. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ProductCheckResult } from '../update-settings.ts'
import css from './UpdateRow.module.css'

/** Registration-side preference face. */
export interface UpdateRowInjected {
  hooks: {
    /** Latest check result and in-flight flag. */
    status: SnapshotStore<ProductUpdateUiStatus>
  }
  /** Ask the Host to poll GitHub now. */
  checkNow: () => void
  /** Persist dismissedTag for the current latest release. */
  dismiss: () => void
  /** Open the latest release URL. */
  openRelease: () => void
}

/** Client-side check presentation. */
export interface ProductUpdateUiStatus {
  checking: boolean
  error: boolean
  result: ProductCheckResult | undefined
}

/** Full Settings-row props. */
export type UpdateRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.productUpdate'>
  & InjectFace<UpdateRowInjected>

/**
 * Render the product-update preference row.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function UpdateRow({
  useStatus, checkNow, dismiss, openRelease, t,
}: UpdateRowProps) {
  const status = useStatus(value => value)
  const result = status.result
  const lastChecked = result === undefined
    ? t('neverChecked')
    : t('lastChecked', { time: formatCheckedAt(result.checkedAt) })
  const version = result?.currentVersion ?? ''
  const available = result?.available === true && result.latest !== undefined
  const dismissed = result !== undefined
    && !result.available
    && result.latest !== undefined
  const statusText = status.checking ? t('checking')
    : status.error ? t('checkFailed')
      : available && result.latest !== undefined ? t('available', { version: result.latest.version })
        : dismissed ? t('dismissed')
          : result !== undefined ? t('upToDate')
            : undefined

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
        {version !== '' && (
          <div className={css.meta}>{t('currentVersion', { version })}</div>
        )}
        <div className={css.meta}>{lastChecked}</div>
        {statusText !== undefined && <div className={css.status}>{statusText}</div>}
      </div>
      <div className={css.controls}>
        <div className={css.actions}>
          <Button
            variant="outline"
            size="sm"
            disabled={status.checking}
            onClick={() => { checkNow() }}
          >
            {t('checkNow')}
          </Button>
          {available && (
            <>
              <Button variant="outline" size="sm" onClick={() => { openRelease() }}>
                {t('openRelease')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { dismiss() }}>
                {t('dismiss')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCheckedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString()
  } catch {
    // RangeError / invalid Date: fall back to the raw epoch.
    return String(ms)
  }
}
