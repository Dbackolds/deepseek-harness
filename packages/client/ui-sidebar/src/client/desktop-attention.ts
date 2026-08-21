/**
 * Optional desktop Host attention: the Web GUI reports the unread Completed
 * count so Electron can badge and bounce the macOS dock icon. A browser tab
 * has no `window.dshDesktop` and this module is a no-op there.
 */

/** Isolated preload face the desktop window injects onto `window`. */
export interface DshDesktopBridge {
  minimize?: () => void
  maximize?: () => void
  close?: () => void
  /**
   * Publish the current unread Completed count. Absent or a throwing call
   * means this page is not the desktop Host, or the Host rejected the request.
   */
  setCompletedUnread?: (count: number) => void
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
 * Publish the unread Completed count to the desktop Host. A missing preload,
 * a missing method, or a throwing call is a no-op.
 * @param count - listed Sessions that still carry the Completed reminder.
 */
export function setDesktopCompletedUnread(count: number): void {
  const setCount = readDesktopBridge()?.setCompletedUnread
  if (setCount === undefined) return
  try {
    setCount(count)
  } catch {
    // Preload or Host rejection must not break the Web GUI.
  }
}
