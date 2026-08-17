/**
 * Live keep-awake preference the Automation page switch and the Host
 * settings section both read.
 */

import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_KEEP_AWAKE, KEEP_AWAKE_FIELD } from '../automation-settings.ts'
import type { AutomationSettings } from '../automation-settings.ts'

export { DEFAULT_KEEP_AWAKE } from '../automation-settings.ts'

/** Live keep-awake preference used by the Automation page. */
export class AutomationKeepAwakePolicy {
  /** Reactive preference source for the page switch. */
  readonly keepAwake: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_KEEP_AWAKE)
  private readonly host: SettingsScope<AutomationSettings> | undefined

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
   * publishes before the durable write starts.
   * @param enabled - whether the Host should keep the machine awake.
   */
  setKeepAwake(enabled: boolean): void {
    if (this.keepAwake.getSnapshot() === enabled) return
    this.keepAwake.set(enabled)
    void this.host?.set(KEEP_AWAKE_FIELD, enabled)
  }

  /**
   * Adopt the scope's accepted durable preference without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<AutomationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined || this.keepAwake.getSnapshot() === section.keepAwake) return
    this.keepAwake.set(section.keepAwake)
  }
}
