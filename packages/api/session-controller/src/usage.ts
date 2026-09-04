/** Host-wide usage Remote for the Settings usage page. */

import type { Context } from '@deepseek-ai/cordis'
import { SessionQueryError } from '@deepseek-ai/dsh-session-query'
import { aggregateUsage, EMPTY_SESSION_USAGE } from '@deepseek-ai/dsh-session-stats'
import type { SessionUsageProjection } from '@deepseek-ai/dsh-session-stats/types'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { UsageOverviewRequest, UsageOverviewValue } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the usage Remote namespace. */
    sessionUsage: SessionUsageController
  }
}

const OVERVIEW_BATCH_SIZE = 8

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0))
    return true
  } catch {
    return false
  }
}

/** Host service backing `ctx.remote.usage` without activating cold Agents. */
export class SessionUsageController extends TypertRemoteService {
  static inject = ['sessionQuery', 'typert']

  /** @param ctx - Host context carrying Session reads and optional projections. */
  constructor(ctx: Context) {
    super(ctx, 'sessionUsage', { namespace: 'usage' })
  }

  /**
   * Sum every visible Session's usage onto the caller calendar.
   * @param request - caller IANA zone used to rebase UTC calendar rows.
   * @param signal - caller lifetime carried by the Remote transport.
   * @returns Host-wide totals, calendar rows, streaks, and model shares.
   * @throws RemoteError when the time zone is invalid or a Session cannot be inspected.
   */
  @Remote
  async overview(request: UsageOverviewRequest, signal: AbortSignal): Promise<UsageOverviewValue> {
    if (!isTimeZone(request.timeZone)) {
      throw new RemoteError('session/invalid-time-zone', 'time zone is not a valid IANA zone', { value: request.timeZone })
    }
    signal.throwIfAborted()
    const records = await this.ctx.sessionQuery.listSessions(signal)
    signal.throwIfAborted()
    const views: SessionUsageProjection[] = []
    for (let offset = 0; offset < records.length; offset += OVERVIEW_BATCH_SIZE) {
      const batch = records.slice(offset, offset + OVERVIEW_BATCH_SIZE)
      const settled = await Promise.allSettled(batch.map(record => this.readUsage(record.header.id, signal)))
      for (const result of settled) {
        if (result.status === 'rejected') throw result.reason
        views.push(result.value)
      }
    }
    return aggregateUsage(views, request.timeZone, Date.now())
  }

  private async readUsage(sessionId: Parameters<Context['sessionQuery']['observeSession']>[0], signal: AbortSignal): Promise<SessionUsageProjection> {
    try {
      using observation = await this.ctx.sessionQuery.observeSession(sessionId, { signal, projectionMode: 'all' })
      return observation.projections?.values.sessionUsage ?? EMPTY_SESSION_USAGE
    } catch (error: unknown) {
      signal.throwIfAborted()
      if (error instanceof SessionQueryError && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') return EMPTY_SESSION_USAGE
      throw new RemoteError('gateway/internal', 'session could not be inspected', {})
    }
  }
}

export default SessionUsageController
