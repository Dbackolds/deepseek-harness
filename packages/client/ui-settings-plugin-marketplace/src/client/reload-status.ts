import type { ReloadProgress } from './ReloadProgressToast.tsx'

export interface ReloadStatus {
  readonly phase: 'idle' | 'running' | 'done'
  readonly current: string
  readonly index: number
  readonly total: number
  readonly ok: number
  readonly failed: number
  readonly message: string
  readonly nonce: number
  readonly clientIds: readonly string[]
  readonly names: readonly string[]
  readonly rebootNonce: number
}

export function asReloadStatus(value: unknown): ReloadStatus | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const row = value as Partial<ReloadStatus>
  if (row.phase !== 'idle' && row.phase !== 'running' && row.phase !== 'done') return undefined
  return {
    phase: row.phase,
    current: typeof row.current === 'string' ? row.current : '',
    index: typeof row.index === 'number' ? row.index : 0,
    total: typeof row.total === 'number' ? row.total : 0,
    ok: typeof row.ok === 'number' ? row.ok : 0,
    failed: typeof row.failed === 'number' ? row.failed : 0,
    message: typeof row.message === 'string' ? row.message : '',
    nonce: typeof row.nonce === 'number' ? row.nonce : 0,
    clientIds: Array.isArray(row.clientIds)
      ? row.clientIds.filter((id): id is string => typeof id === 'string')
      : [],
    names: Array.isArray(row.names)
      ? row.names.filter((id): id is string => typeof id === 'string')
      : [],
    rebootNonce: typeof row.rebootNonce === 'number' ? row.rebootNonce : 0,
  }
}

export function progressFromStatus(status: ReloadStatus | undefined): ReloadProgress | undefined {
  if (status === undefined) return undefined
  return {
    phase: status.phase,
    current: status.current,
    index: status.index,
    total: status.total,
    ok: status.ok,
    failed: status.failed,
    message: status.message,
  }
}

/**
 * Read the reboot nonce stored just before a post-reboot page load.
 * The old boolean flag `'1'` is leftover from a failed or reconnect-triggered
 * reload and must not settle a later `/reboot` card.
 * @param raw - `sessionStorage` value, or null when unset.
 * @returns the nonce, or undefined when the value is missing or stale.
 */
export function storedRebootNonce(raw: string | null = sessionStorageValue()): number | undefined {
  if (raw === null || raw === '' || raw === '1') return undefined
  const nonce = Number(raw)
  return Number.isFinite(nonce) ? nonce : undefined
}

function sessionStorageValue(): string | null {
  try { return sessionStorage.getItem('dsh-marketplace-rebooted') }
  catch { return null }
}

/** After the Host process dies and a new generation connects. */
export function hostGenerationAfterLoss(state: {
  seenHost: boolean
  lostHost: boolean
  up: boolean
}): { seenHost: boolean; lostHost: boolean; reload: boolean } {
  let seenHost = state.seenHost
  let lostHost = state.lostHost
  if (seenHost && !state.up) lostHost = true
  if (state.up) seenHost = true
  const reload = lostHost && state.up
  if (reload) lostHost = false
  return { seenHost, lostHost, reload }
}

export function sameReloadStatus(left: ReloadStatus | undefined, right: ReloadStatus | undefined): boolean {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return left.phase === right.phase
    && left.current === right.current
    && left.index === right.index
    && left.total === right.total
    && left.ok === right.ok
    && left.failed === right.failed
    && left.message === right.message
    && left.nonce === right.nonce
    && left.clientIds.join('\0') === right.clientIds.join('\0')
    && left.names.join('\0') === right.names.join('\0')
    && left.rebootNonce === right.rebootNonce
}
