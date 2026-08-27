/**
 * Live product-wide retry and idle-timeout preference used by the Settings row.
 */
import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_UNLIMITED,
  MAX_RETRIES_FIELD,
  STREAM_IDLE_TIMEOUT_MS_FIELD,
  UNLIMITED_FIELD,
} from '@deepseek-ai/dsh-llm-default-policy/defaults'
import type { LlmDefaultPolicySettings } from '@deepseek-ai/dsh-llm-default-policy/defaults'

export {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  DEFAULT_UNLIMITED,
} from '@deepseek-ai/dsh-llm-default-policy/defaults'

/** Live product-wide policy used by the Settings row. */
export class LlmDefaultPolicyPreference {
  /** Reactive finite retry budget. */
  readonly maxRetries: SnapshotStore<number> = createSnapshotStore(DEFAULT_MAX_RETRIES)
  /** Reactive unbounded-retry switch. */
  readonly unlimited: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_UNLIMITED)
  /** Reactive outstanding-read idle interval in milliseconds. */
  readonly streamIdleTimeoutMs: SnapshotStore<number> = createSnapshotStore(DEFAULT_STREAM_IDLE_TIMEOUT_MS)
  private readonly host: SettingsScope<LlmDefaultPolicySettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local.
   */
  constructor(host?: SettingsScope<LlmDefaultPolicySettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change the finite retry budget; the live value publishes before the write.
   * @param maxRetries - additional attempts after the first request.
   */
  setMaxRetries(maxRetries: number): void {
    if (this.maxRetries.getSnapshot() === maxRetries) return
    this.maxRetries.set(maxRetries)
    void this.host?.set(MAX_RETRIES_FIELD, maxRetries)
  }

  /**
   * Change whether every model-request failure retries without a limit.
   * @param unlimited - whether unbounded retry is on.
   */
  setUnlimited(unlimited: boolean): void {
    if (this.unlimited.getSnapshot() === unlimited) return
    this.unlimited.set(unlimited)
    void this.host?.set(UNLIMITED_FIELD, unlimited)
  }

  /**
   * Change the outstanding-read idle interval; the live value publishes first.
   * @param streamIdleTimeoutMs - positive finite interval in milliseconds.
   */
  setStreamIdleTimeoutMs(streamIdleTimeoutMs: number): void {
    if (this.streamIdleTimeoutMs.getSnapshot() === streamIdleTimeoutMs) return
    this.streamIdleTimeoutMs.set(streamIdleTimeoutMs)
    void this.host?.set(STREAM_IDLE_TIMEOUT_MS_FIELD, streamIdleTimeoutMs)
  }

  /**
   * Adopt the scope's accepted durable preference without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<LlmDefaultPolicySettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    if (this.maxRetries.getSnapshot() !== section.maxRetries) this.maxRetries.set(section.maxRetries)
    if (this.unlimited.getSnapshot() !== section.unlimited) this.unlimited.set(section.unlimited)
    if (this.streamIdleTimeoutMs.getSnapshot() !== section.streamIdleTimeoutMs) {
      this.streamIdleTimeoutMs.set(section.streamIdleTimeoutMs)
    }
  }
}
