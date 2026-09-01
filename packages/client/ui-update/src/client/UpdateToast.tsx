/** Overlay toast when a newer product release is available. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ProductUpdateUiStatus } from './UpdateRow.tsx'
import css from './UpdateToast.module.css'

/** Registration-side overlay face. */
export interface UpdateToastInjected {
  hooks: {
    status: SnapshotStore<ProductUpdateUiStatus>
  }
  dismiss: () => void
  openRelease: () => void
}

/** Overlay slot props. */
export type UpdateToastProps =
  PropsRuntime<'shell.overlay'>
  & PropsLocale<'settings.productUpdate'>
  & InjectFace<UpdateToastInjected>

/**
 * Render the product-update overlay toast.
 * @param props - composed overlay slot props.
 * @returns the toast, or null when no update is available.
 */
export function UpdateToast({
  useStatus, dismiss, openRelease, t,
}: UpdateToastProps) {
  const status = useStatus(value => value)
  const latest = status.result?.available === true ? status.result.latest : undefined
  if (latest === undefined) return null
  return (
    <div className={css.toast} role="status">
      <div className={css.toastTitle}>{t('toastTitle')}</div>
      <div>{t('toastBody', { version: latest.version })}</div>
      <div className={css.toastActions}>
        <Button variant="outline" size="sm" onClick={() => { openRelease() }}>
          {t('toastOpen')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { dismiss() }}>
          {t('toastDismiss')}
        </Button>
      </div>
    </div>
  )
}
