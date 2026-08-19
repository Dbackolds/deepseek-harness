// Shared IconActions chrome for user and assistant messages: copy
// live, optional branch wiring, and optional settled-turn metrics.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  IconBranchOutline16, IconCheckOutline16, IconCopyOutline16, Tooltip, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { formatLatencySeconds, formatRunDuration, formatTokensPerSecond } from './message-chrome.ts'
import css from './MessageIconActions.module.css'

export interface MessageIconActionsProps {
  /** Plain text the copy action writes. */
  text: string
  /** Turn wall time in ms, shown as `Ran for 15s`; omitted when the turn's start is unknown. */
  runMs?: number | undefined
  /** Turn first-step TTFT in ms, appended as `· TTFT 1.2s`; omitted when unrecorded. */
  ttftMs?: number | undefined
  /** Turn decode throughput, appended as `· 34 tok/s`; omitted when unrecorded. */
  tokensPerSecond?: number | undefined
  /** Fork the session at this message; omission hides the branch action. */
  onBranch?: (() => void) | undefined
  /** The message is not a completed transcript tail, so branch stays visible but unavailable. */
  branchUnavailable?: boolean | undefined
  /** Parent layout class composed onto the actions row. */
  className?: string | undefined
  /**
   * Slot-rendered actions owned by independent plugins, placed between the
   * built-in copy and branch controls.
   */
  extraActions?: ReactNode
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/**
 * Copy / branch IconActions row shared by user and assistant chrome.
 * @param props - Copy text, optional run metrics, branch callback, className.
 * @returns The actions row element.
 */
export function MessageIconActions({
  text, runMs, ttftMs, tokensPerSecond, onBranch, branchUnavailable = false, className,
  extraActions, t,
}: MessageIconActionsProps) {
  const reasonId = useId()
  // Same success chrome as CodeBlock: a short check swap after the write,
  // gated so re-clicks during the window neither re-copy nor stack timers.
  const [copied, setCopied] = useState(false)
  const copyPending = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyEpoch = useRef(0)
  useEffect(() => () => {
    copyEpoch.current += 1
    copyPending.current = false
    if (copyTimer.current !== null) clearTimeout(copyTimer.current)
  }, [])
  const onCopy = useCallback(() => {
    if (copied || copyPending.current) return
    const epoch = copyEpoch.current
    copyPending.current = true
    void writeClipboard(text).then((ok) => {
      if (epoch !== copyEpoch.current) return
      copyPending.current = false
      if (!ok) return
      setCopied(true)
      copyTimer.current = window.setTimeout(() => {
        copyTimer.current = null
        setCopied(false)
      }, 1000)
    })
  }, [copied, text])
  // The dot is decorative and stays hidden, but its margins separate the
  // readings only on screen: without the flanking spaces a reader hears one
  // run-on string ("Ran for 13sTTFT 0.2s12 tok/s") instead of three facts.
  const metrics = runMs === undefined && ttftMs === undefined && tokensPerSecond === undefined
    ? null
    : (
      <span className={css.metrics}>
        {runMs !== undefined && t('message.ranFor', { duration: formatRunDuration(runMs, t) })}
        {ttftMs !== undefined && (
          <>
            {runMs !== undefined && ' '}
            <span className={css.runTimeDot} aria-hidden>·</span>
            {' '}
            {t('message.ttft', { seconds: formatLatencySeconds(ttftMs) })}
          </>
        )}
        {tokensPerSecond !== undefined && (
          <>
            {(runMs !== undefined || ttftMs !== undefined) && ' '}
            <span className={css.runTimeDot} aria-hidden>·</span>
            {' '}
            {t('message.tokensPerSecond', { tps: formatTokensPerSecond(tokensPerSecond) })}
          </>
        )}
      </span>
    )
  return (
    <div className={className === undefined ? css.actions : `${css.actions} ${className}`}>
      {metrics}
      <Tooltip label={copied ? t('copied') : t('copy')} side="bottom">
        <button type="button" className={css.action} aria-label={copied ? t('copied') : t('copy')} onClick={onCopy}>
          {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
        </button>
      </Tooltip>
      {extraActions}
      {onBranch !== undefined && (
        <Tooltip label={branchUnavailable ? t('message.branchUnavailable') : t('message.branch')} side="bottom">
          {/* Native disabled buttons do not deliver the hover/focus events Tooltip needs. */}
          <button
            type="button"
            className={css.action}
            aria-label={t('message.branch')}
            aria-disabled={branchUnavailable || undefined}
            aria-describedby={branchUnavailable ? reasonId : undefined}
            data-unavailable={branchUnavailable || undefined}
            onClick={branchUnavailable ? undefined : onBranch}
          >
            <IconBranchOutline16 />
          </button>
        </Tooltip>
      )}
      {onBranch !== undefined && branchUnavailable && (
        <span id={reasonId} className={css.visuallyHidden}>{t('message.branchUnavailable')}</span>
      )}
    </div>
  )
}
