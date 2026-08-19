/**
 * Optional desktop Host attention: the Web GUI asks the Electron preload to
 * bounce the macOS dock icon. A browser tab has no `window.dshDesktop` and
 * this module is a no-op there.
 */

/** Isolated preload face the desktop window injects onto `window`. */
export interface DshDesktopBridge {
  minimize?: () => void
  maximize?: () => void
  close?: () => void
  /**
   * Bounce the macOS dock icon once. Absent or a throwing call means this
   * page is not the desktop Host, or the Host rejected the request.
   */
  notifyCompleted?: () => void
}

/**
 * Read the isolated preload face when this page is the desktop window.
 * @returns the preload object, or `undefined` in a plain browser tab.
 */
export function readDesktopBridge(
  target: { dshDesktop?: DshDesktopBridge } | undefined = globalThis as { dshDesktop?: DshDesktopBridge },
): DshDesktopBridge | undefined {
  return target?.dshDesktop
}

/**
 * Ask the desktop Host to bounce the dock icon. A missing preload, a missing
 * method, or a throwing call is a no-op — the in-page badge still stands.
 */
export function notifyDesktopCompletedAttention(): void {
  const notify = readDesktopBridge()?.notifyCompleted
  if (notify === undefined) return
  try {
    notify()
  } catch {
    // Preload or Host rejection must not break the in-page badge.
  }
}
