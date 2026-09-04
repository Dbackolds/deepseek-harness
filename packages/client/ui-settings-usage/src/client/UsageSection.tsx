import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { UsageOverviewValue } from '@deepseek-ai/dsh-api-remotes/client'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  dayLabel, donutSegments, formatCompactNumber, formatDuration, heatmapCells, heatmapLevel,
  monthLabel, modelColor, polyline, trendDays,
  type ActivityMode, type RangeDays, type Translate,
} from './format.ts'
import css from './UsageSection.module.css'

/** Registration-side Remote face used by the section. */
export interface UsageSectionInjected {
  /** Read the Host-wide usage snapshot for one IANA zone. */
  load: (timeZone: string) => Promise<UsageOverviewValue>
}

/** Full component props assembled by the Settings slot renderer. */
export type UsageSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.usage'>
  & InjectFace<UsageSectionInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly overview: UsageOverviewValue }

function zonedTodaySafe(): string {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value ?? '1970'
  const month = parts.find(part => part.type === 'month')?.value ?? '01'
  const day = parts.find(part => part.type === 'day')?.value ?? '01'
  return year + '-' + month + '-' + day
}

function clientTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function UsageSection({ load, t }: UsageSectionProps): ReactNode {
  const [request, setRequest] = useState(0)
  const [activity, setActivity] = useState<ActivityMode>('daily')
  const [range, setRange] = useState<RangeDays>(7)
  const [state, setState] = useState<ViewState>({ status: 'loading' })
  const today = zonedTodaySafe()

  useEffect(() => {
    let current = true
    setState({ status: 'loading' })
    void Promise.resolve().then(() => load(clientTimeZone())).then(
      (overview) => { if (current) setState({ status: 'ready', overview }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [load, request])

  const compact = (value: number): string => formatCompactNumber(value, t, t('number.wan') !== t('number.thousand'))

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={() => { setRequest(value => value + 1) }}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <ReadyView
          overview={state.overview}
          activity={activity}
          range={range}
          today={today}
          compact={compact}
          t={t}
          onActivity={setActivity}
          onRange={setRange}
        />
      ) : null}
    </div>
  )
}

function ReadyView({ overview, activity, range, today, compact, t, onActivity, onRange }: {
  overview: UsageOverviewValue
  activity: ActivityMode
  range: RangeDays
  today: string
  compact: (value: number) => string
  t: Translate
  onActivity: (mode: ActivityMode) => void
  onRange: (days: RangeDays) => void
}): ReactNode {
  const heat = useMemo(() => heatmapCells(overview.days, activity, today), [activity, overview.days, today])
  const heatPeak = useMemo(() => Math.max(0, ...heat.map(cell => cell.tokens)), [heat])
  const months = useMemo(() => {
    const labels: { day: string; label: string }[] = []
    let last = ''
    for (const cell of heat) {
      if (cell.day.slice(0, 7) === last) continue
      last = cell.day.slice(0, 7)
      labels.push({ day: cell.day, label: monthLabel(cell.day, t) })
    }
    return labels
  }, [heat, t])
  const trend = useMemo(() => trendDays(overview.days, range, today), [overview.days, range, today])
  const models = overview.models.slice(0, 8)
  const series = models.map(row => trend.map(day => day.models[row.model] ?? 0))
  const width = 640
  const height = 160
  const segments = donutSegments(overview.models)
  const empty = overview.tokens === 0 && overview.durationMs === 0
  return (
    <>
      <dl className={css.metrics}>
        <Metric value={compact(overview.tokens)} label={t('metricTokens')} />
        <Metric value={compact(overview.peakTokens)} label={t('metricPeakTokens')} />
        <Metric value={formatDuration(overview.peakDurationMs, t)} label={t('metricLongestChat')} />
        <Metric value={t('daysUnit', { value: overview.currentStreakDays })} label={t('metricCurrentStreak')} />
        <Metric value={t('daysUnit', { value: overview.longestStreakDays })} label={t('metricLongestStreak')} />
      </dl>
      {empty ? <p className={css.status}>{t('empty')}</p> : null}
      <section className={css.card} aria-labelledby="usage-activity">
        <div className={css.cardHead}>
          <h3 className={css.cardTitle} id="usage-activity">{t('activity')}</h3>
          <div className={css.pills} role="tablist" aria-label={t('activity')}>
            <Pill active={activity === 'daily'} onClick={() => { onActivity('daily') }}>{t('activityDaily')}</Pill>
            <Pill active={activity === 'weekly'} onClick={() => { onActivity('weekly') }}>{t('activityWeekly')}</Pill>
            <Pill active={activity === 'cumulative'} onClick={() => { onActivity('cumulative') }}>{t('activityCumulative')}</Pill>
          </div>
        </div>
        <div className={css.heatmap} role="img" aria-label={t('activity')}>
          {heat.map(cell => (
            <span key={cell.day} className={css.heatCell} data-day={cell.day} data-level={heatmapLevel(cell.tokens, heatPeak)} title={cell.day + ': ' + cell.tokens} />
          ))}
        </div>
        <div className={css.monthRow}>{months.map(month => <span key={month.day}>{month.label}</span>)}</div>
      </section>
      <div className={css.toolbar}>
        <h3 className={css.cardTitle}>{t('range')}</h3>
        <div className={css.pills} role="tablist" aria-label={t('range')}>
          <Pill active={range === 7} onClick={() => { onRange(7) }}>{t('range7')}</Pill>
          <Pill active={range === 30} onClick={() => { onRange(30) }}>{t('range30')}</Pill>
        </div>
      </div>
      <section className={css.card} aria-labelledby="usage-trend">
        <h3 className={css.cardTitle} id="usage-trend">{t('trend')}</h3>
        <div className={css.legend}>
          {models.map((row, index) => (
            <span className={css.legendItem} key={row.model}>
              <span className={css.swatch} style={{ background: modelColor(index) }} />
              {row.model}
            </span>
          ))}
        </div>
        <svg className={css.chart} viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={t('trend')}>
          {series.map((values, index) => (
            <polyline
              key={models[index]?.model ?? String(index)}
              fill="none"
              stroke={modelColor(index)}
              strokeWidth="2"
              points={polyline(values, width, height - 8)}
            />
          ))}
        </svg>
        <div className={css.axis}>{trend.map(day => <span key={day.day}>{dayLabel(day.day)}</span>)}</div>
      </section>
      <section className={css.card} aria-labelledby="usage-models">
        <h3 className={css.cardTitle} id="usage-models">{t('models')}</h3>
        <div className={css.donutWrap}>
          <svg className={css.donut} viewBox="0 0 120 120" role="img" aria-label={t('models')}>
            <Donut segments={segments} total={overview.tokens} compact={compact} unit={t('tokensUnit')} />
          </svg>
          <ul className={css.modelList}>
            {segments.map(segment => (
              <li className={css.modelRow} key={segment.model}>
                <span className={css.swatch} style={{ background: segment.color }} />
                <span className={css.modelMeta}>
                  <strong>{segment.model}</strong>
                  <span>{compact(segment.tokens)} {t('tokensUnit')}</span>
                </span>
                <span className={css.percent}>{segment.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function Metric({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <div className={css.metric}>
      <dt className={css.metricLabel}>{label}</dt>
      <dd className={css.metricValue}>{value}</dd>
    </div>
  )
}

function Donut({ segments, total, compact, unit }: {
  segments: ReturnType<typeof donutSegments>
  total: number
  compact: (value: number) => string
  unit: string
}): ReactNode {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--dsw-alias-bg-layer-2)" strokeWidth="16" />
      {segments.map((segment) => {
        const length = circumference * (segment.percent / 100)
        const node = (
          <circle key={segment.model} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth="16" strokeDasharray={length + ' ' + (circumference - length)} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
        )
        offset += length
        return node
      })}
      <text x="60" y="56" textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor">{compact(total)}</text>
      <text x="60" y="74" textAnchor="middle" fontSize="10" fill="var(--dsw-alias-label-tertiary)">{unit}</text>
    </>
  )
}
