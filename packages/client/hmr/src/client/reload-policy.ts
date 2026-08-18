/**
 * Client-plugin reload policy. It owns the live auto-reload preference the
 * Settings row and the SSE driver both read.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { AUTO_RELOAD_FIELD, DEFAULT_AUTO_RELOAD } from '../hmr-settings.ts'
import type { ClientHmrSettings } from '../hmr-settings.ts'

export { DEFAULT_AUTO_RELOAD } from '../hmr-settings.ts'

/** Live auto-reload preference used by the Settings row and the SSE driver. */
export class ClientHmrReloadPolicy {
  /** Reactive preference source for the Settings row. */
  readonly autoReload: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_AUTO_RELOAD)
  private readonly host: SettingsScope<ClientHmrSettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local.
   */
  constructor(host?: SettingsScope<ClientHmrSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change whether rebuilt bundles reload without a refresh; the live value
   * publishes before the durable write starts.
   * @param enabled - whether automatic reloads run.
   */
  setAutoReload(enabled: boolean): void {
    if (this.autoReload.getSnapshot() === enabled) return
    this.autoReload.set(enabled)
    void this.host?.set(AUTO_RELOAD_FIELD, enabled)
  }

  /**
   * Adopt the scope's accepted durable preference without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<ClientHmrSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined || this.autoReload.getSnapshot() === section.autoReload) return
    this.autoReload.set(section.autoReload)
  }
}
