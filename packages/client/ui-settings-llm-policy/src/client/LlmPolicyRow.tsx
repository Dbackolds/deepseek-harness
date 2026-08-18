/** General Settings row for the product-wide retry budget and stream-idle timeout. */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
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
 * Render the product-wide retry and timeout preference row.
 * @param props - composed Settings slot props.
 * @returns the preference row.
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
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
      </div>
      <div className={css.controls}>
        <label className={css.field}>
          <span className={css.label}>{t('retries')}</span>
          <input
            className={parsedRetries === undefined ? css.inputInvalid : css.input}
            inputMode="numeric"
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
          <span className={parsedRetries === undefined ? css.invalid : css.hint}>
            {parsedRetries === undefined ? t('invalidRetries') : t('retriesHint')}
          </span>
        </label>
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
        <label className={css.field}>
          <span className={css.label}>{t('timeout')}</span>
          <input
            className={parsedTimeout === undefined ? css.inputInvalid : css.input}
            inputMode="decimal"
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
          <span className={parsedTimeout === undefined ? css.invalid : css.hint}>
            {parsedTimeout === undefined ? t('invalidTimeout') : t('timeoutHint')}
          </span>
        </label>
      </div>
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Product-wide retry and timeout row copy. */
    'settings.llm-policy': LlmPolicySettingsKey
  }
}
