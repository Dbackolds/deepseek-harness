/**
 * macOS dock bounce for a newly unread Completed reminder.
 * @module @deepseek-ai/dsh-desktop/dock-attention
 */

/** Electron dock face used by the bounce helper. */
export interface DockBounce {
  bounce(type?: 'critical' | 'informational'): number
}

/**
 * Bounce the dock icon once. Informational bounce lasts about one second.
 * Electron returns -1 while the app is focused; that result is ignored.
 * @param dock - `app.dock` on darwin, or `undefined` on other platforms.
 */
export function bounceDockForCompleted(dock: DockBounce | undefined): void {
  dock?.bounce('informational')
}
