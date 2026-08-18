import { useEffect, useState, type ReactNode } from 'react'
import type { MarketplaceLocaleKey } from './locales.ts'
import css from './MarketplaceSettingsSection.module.css'

export interface ReloadProgress {
  readonly phase: 'idle' | 'running' | 'done'
  readonly current: string
  readonly index: number
  readonly total: number
  readonly ok: number
  readonly failed: number
  readonly message: string
}

export function ReloadProgressToast(props: {
  progress: ReloadProgress | undefined
  t: (key: MarketplaceLocaleKey) => string
  live?: boolean
}): ReactNode {
  const progress = props.progress
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (progress === undefined || progress.phase === 'idle' || props.live !== true) {
      setVisible(false)
      return
    }
    setVisible(true)
    if (progress.phase !== 'done') return
    const timer = setTimeout(() => { setVisible(false) }, 4000)
    return () => { clearTimeout(timer) }
  }, [progress?.phase, progress?.index, progress?.message, props.live])
  if (!visible || progress === undefined || progress.phase === 'idle') return null
  return (
    <div className={css.reloadToast} role="status">
      <strong>{progress.phase === 'done' ? props.t('reloadDone') : props.t('reloadProgress')}</strong>
      <span>{progress.message || progress.current}</span>
    </div>
  )
}
