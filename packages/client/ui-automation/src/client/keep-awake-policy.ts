/**
 * Live keep-awake preference the Automation page switch and the Host
 * settings section both read.
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULT_KEEP_AWAKE, KEEP_AWAKE_FIELD } from '../automation-settings.ts'
import type { AutomationSettings } from '../automation-settings.ts'

export { DEFAULT_KEEP_AWAKE } from '../automation-settings.ts'

/** Live keep-awake preference used by the Automation page. */
export class AutomationKeepAwakePolicy {
  /** Reactive preference source for the page switch. */
  readonly keepAwake: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_KEEP_AWAKE)
  private readonly host: SettingsScope<AutomationSettings> | undefined
  /** In-flight user choice; Host snapshots must not overwrite it until that write settles. */
  private pending: boolean | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local.
   */
  constructor(host?: SettingsScope<AutomationSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change whether a live Host holds an OS sleep assertion; the live value
   * publishes before the durable write starts. A later Host snapshot that
   * still carries the previous value is ignored until this write settles.
   * @param enabled - whether the Host should keep the machine awake.
   */
  setKeepAwake(enabled: boolean): void {
    if (this.keepAwake.getSnapshot() === enabled && this.pending === undefined) return
    this.keepAwake.set(enabled)
    const host = this.host
    if (host === undefined) return
    this.pending = enabled
    void host.set(KEEP_AWAKE_FIELD, enabled).then(
      () => {
        if (this.pending === enabled) this.pending = undefined
      },
      () => {
        if (this.pending !== enabled) return
        this.pending = undefined
        this.adopt(host)
      },
    )
  }

  /**
   * Adopt the scope's accepted durable preference without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<AutomationSettings>): void {
    const snapshot = host.getSnapshot()
    if (snapshot.status !== 'ready' || snapshot.value === undefined) return
    if (this.pending !== undefined) return
    if (this.keepAwake.getSnapshot() === snapshot.value.keepAwake) return
    this.keepAwake.set(snapshot.value.keepAwake)
  }
}
