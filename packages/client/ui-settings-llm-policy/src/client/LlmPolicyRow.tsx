/** General Settings rows for the product-wide retry budget and stream-idle timeout. */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LlmPolicySettingsKey } from './locales.ts'
import css from './LlmPolicyRow.module.css'

/** Registration-side preference face. */
export interface LlmPolicyRowInjected {
  hooks: {
    /** Persisted finite retry budget bound as useMaxRetries. */
    maxRetries: SnapshotStore<number>
    /** Persisted unbounded-retry switch bound as useUnlimited. */
    unlimited: SnapshotStore<boolean>
    /** Persisted idle interval in milliseconds bound as useStreamIdleTimeoutMs. */
    streamIdleTimeoutMs: SnapshotStore<number>
  }
  /** Change the finite retry budget. */
  setMaxRetries: (maxRetries: number) => void
  /** Change whether unbounded retry is on. */
  setUnlimited: (unlimited: boolean) => void
  /** Change the outstanding-read idle interval in milliseconds. */
  setStreamIdleTimeoutMs: (streamIdleTimeoutMs: number) => void
}

/** Full Settings-row props. */
export type LlmPolicyRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.llm-policy'>
  & InjectFace<LlmPolicyRowInjected>

function parseRetries(text: string): number | undefined {
  if (!/^\d+$/.test(text)) return undefined
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : undefined
}

function parseTimeoutSeconds(text: string): number | undefined {
  if (text.trim() === '' || !Number.isFinite(Number(text))) return undefined
  const seconds = Number(text)
  if (seconds <= 0) return undefined
  return Math.round(seconds * 1000)
}

/**
 * Render the product-wide retry and timeout preference rows.
 * @param props - composed Settings slot props.
 * @returns the preference rows.
 */
export function LlmPolicyRow({
  useMaxRetries,
  useUnlimited,
  useStreamIdleTimeoutMs,
  setMaxRetries,
  setUnlimited,
  setStreamIdleTimeoutMs,
  t,
}: LlmPolicyRowProps) {
  const maxRetries = useMaxRetries(value => value)
  const unlimited = useUnlimited(value => value)
  const streamIdleTimeoutMs = useStreamIdleTimeoutMs(value => value)
  const [retriesText, setRetriesText] = useState(String(maxRetries))
  const [timeoutText, setTimeoutText] = useState(String(streamIdleTimeoutMs / 1000))

  useEffect(() => {
    setRetriesText(String(maxRetries))
  }, [maxRetries])
  useEffect(() => {
    setTimeoutText(String(streamIdleTimeoutMs / 1000))
  }, [streamIdleTimeoutMs])

  const parsedRetries = parseRetries(retriesText)
  const parsedTimeout = parseTimeoutSeconds(timeoutText)

  return (
    <>
      <div className={css.row}>
        <div className={css.rowText}>
          <div className={css.title}>{t('retries.title')}</div>
          <div className={css.desc}>{t('retries.description')}</div>
        </div>
        <div className={css.controls}>
          {parsedRetries === undefined && <span className={css.invalid}>{t('invalidRetries')}</span>}
          <input
            className={parsedRetries === undefined ? css.inputInvalid : css.input}
            inputMode="numeric"
            aria-label={t('retries.title')}
            disabled={unlimited}
            value={retriesText}
            aria-invalid={parsedRetries === undefined || undefined}
            onChange={(event) => { setRetriesText(event.target.value) }}
            onBlur={() => {
              if (parsedRetries === undefined) {
                setRetriesText(String(maxRetries))
                return
              }
              setMaxRetries(parsedRetries)
            }}
          />
          <button
            type="button"
            className={css.switch}
            role="switch"
            aria-checked={unlimited}
            onClick={() => { setUnlimited(!unlimited) }}
          >
            <span>{t('unlimited')}</span>
            <span className={css.track} data-on={unlimited || undefined} aria-hidden="true">
              <span className={css.thumb} />
            </span>
          </button>
        </div>
      </div>
      <div className={css.row}>
        <div className={css.rowText}>
          <div className={css.title}>{t('timeout.title')}</div>
          <div className={css.desc}>{t('timeout.description')}</div>
        </div>
        <div className={css.controls}>
          {parsedTimeout === undefined && <span className={css.invalid}>{t('invalidTimeout')}</span>}
          <input
            className={parsedTimeout === undefined ? css.inputInvalid : css.input}
            inputMode="decimal"
            aria-label={t('timeout.title')}
            value={timeoutText}
            aria-invalid={parsedTimeout === undefined || undefined}
            onChange={(event) => { setTimeoutText(event.target.value) }}
            onBlur={() => {
              if (parsedTimeout === undefined) {
                setTimeoutText(String(streamIdleTimeoutMs / 1000))
                return
              }
              setStreamIdleTimeoutMs(parsedTimeout)
            }}
          />
          <span className={css.unit}>{t('timeout.unit')}</span>
        </div>
      </div>
    </>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Product-wide retry and timeout row copy. */
    'settings.llm-policy': LlmPolicySettingsKey
  }
}
