/** Keep client-hmr.autoReload off while the marketplace is installed. */

export const CLIENT_HMR_NAMESPACE = 'client-hmr'

export interface HmrPinSettings {
  get?: (ns: unknown) => { autoReload?: boolean } | undefined
  update?: (ns: unknown, patch: object) => Promise<unknown>
}

/**
 * Force autoReload off only when it is already true.
 * A missing section already defaults to false; writing it at boot can throw
 * if client-hmr has not registered yet and take the Host down with it.
 * Never restore the previous value: /reload disposes this plugin and must
 * not turn automatic client swaps back on.
 */
export function pinAutoReloadOff(
  settings: HmrPinSettings | undefined,
  ns: unknown = CLIENT_HMR_NAMESPACE,
): Promise<unknown> | undefined {
  if (settings?.update === undefined) return undefined
  if (settings.get?.(ns)?.autoReload !== true) return undefined
  try {
    return Promise.resolve(settings.update(ns, { autoReload: false })).catch(() => undefined)
  } catch {
    return undefined
  }
}
