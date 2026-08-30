/**
 * Sidebar Session-overflow policy. It owns the live preference for the
 * Settings row and the browsing region's overflow controls.
 */
import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_SESSION_OVERFLOW_LIMIT, SESSION_OVERFLOW_FIELD, type SessionOverflowLimit,
  type WorkspaceSettings,
} from '../workspace-settings.ts'

export { DEFAULT_SESSION_OVERFLOW_LIMIT } from '../workspace-settings.ts'

/**
 * Overflow preference used by both the Settings row and the sidebar browser.
 */
export class SessionOverflowPolicy {
  /** Reactive preference source for the Settings row and browser. */
  readonly sessionOverflowLimit: SnapshotStore<SessionOverflowLimit> =
    createSnapshotStore(DEFAULT_SESSION_OVERFLOW_LIMIT)

  private readonly host: SettingsScope<WorkspaceSettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local. The adoption subscription shares
   * the scope's plugin lifetime — a disposed scope never publishes again, so
   * the policy needs no release hook.
   */
  constructor(host?: SettingsScope<WorkspaceSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change the overflow step; the live value publishes before the durable write starts.
   * @param limit - finite step or expand-all.
   */
  setSessionOverflowLimit(limit: SessionOverflowLimit): void {
    if (this.sessionOverflowLimit.getSnapshot() === limit) return
    this.sessionOverflowLimit.set(limit)
    void this.host?.set(SESSION_OVERFLOW_FIELD, limit)
  }

  /**
   * Adopt the scope's accepted durable behavior without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<WorkspaceSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    if (this.sessionOverflowLimit.getSnapshot() === section.sessionOverflowLimit) return
    this.sessionOverflowLimit.set(section.sessionOverflowLimit)
  }
}
