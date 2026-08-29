/**
 * Host-process start time and start count shown in the settings content header.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SettingsRoot.module.css'
import { formatHostStartTime, type HostStartMetaView } from './host-start-meta.ts'

/**
 * Render the Host-start meta, or nothing while the section is not ready.
 * @param props - live facts plus the settings translator.
 * @param props.meta - Host-process start facts from the settings section.
 * @param props.t - settings-namespace translator.
 * @returns the meta node, or null.
 */
export function HostStartMeta(props: {
  meta: HostStartMetaView
  t: TranslateNS<'settings'>
}) {
  const { meta, t } = props
  const time = meta.startedAt === undefined ? undefined : formatHostStartTime(meta.startedAt)
  if (meta.status !== 'ready' || time === undefined || meta.startCount <= 0) return null
  return (
    <span className={css.hostStart}>{t('hostStart.meta', { time, count: String(meta.startCount) })}</span>
  )
}
