/**
 * Browser projection of Host-process start time and start count.
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { HostLifetimeSettings } from '../host-lifetime.ts'

/** Live Host-start facts for the settings header. */
export interface HostStartMetaView {
  /** Whether the Host section has been accepted. */
  status: 'loading' | 'ready' | 'unavailable'
  /** Current process start as a UTC instant. */
  startedAt?: string
  /** How many Host processes this home has started. */
  startCount: number
}

const EMPTY: HostStartMetaView = { status: 'loading', startCount: 0 }

/** Live Host-start facts used by the settings header. */
export class HostStartMetaPolicy {
  /** Reactive source for the header. */
  readonly store: SnapshotStore<HostStartMetaView> = createSnapshotStore(EMPTY)

  /**
   * @param host - durable lifetime scope; absent compositions stay hidden.
   */
  constructor(host?: SettingsScope<HostLifetimeSettings>) {
    if (host === undefined) {
      this.store.set({ status: 'unavailable', startCount: 0 })
      return
    }
    host.subscribe(() => { this.adopt(host) })
    this.adopt(host)
  }

  /**
   * Adopt the scope's accepted Host-lifetime section.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<HostLifetimeSettings>): void {
    const snapshot = host.getSnapshot()
    if (snapshot.status === 'loading') {
      this.store.set(EMPTY)
      return
    }
    if (snapshot.status !== 'ready' || snapshot.value === undefined) {
      this.store.set({ status: 'unavailable', startCount: 0 })
      return
    }
    const startedAt = snapshot.value.startedAt
    this.store.set({
      status: 'ready',
      startCount: snapshot.value.startCount,
      ...startedAt === undefined || startedAt.length === 0 ? {} : { startedAt },
    })
  }
}

/**
 * Format a UTC instant for the settings header, using the UI locale.
 * @param iso - UTC instant from the Host section.
 * @returns a short local date and time, or the raw instant when unparseable.
 */
export function formatHostStartTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
