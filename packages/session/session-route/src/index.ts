/**
 * Function plugin registering the `requestRoute` projection unit: the
 * latest-wins fold of `request/header` events over the whole session log into
 * the dispatched request route (provider, model, optional reasoning effort),
 * served through the session-projection seam (registry snapshot, change feed,
 * and every projection carrier), so clients read the identity of the model a
 * session actually runs — a whole-log figure that paging and compaction cannot
 * change, never the composer selector state. The plugin owns only the fold;
 * delivery is the seam's.
 *
 * @module @deepseek-ai/dsh-session-route
 */

import type { Context } from '@deepseek-ai/cordis'
import { requestRouteProjectionDefinition } from './projection.ts'

export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'session-route'
/** The projection registry is the plugin's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

/**
 * Register the `requestRoute` unit; the registration is an effect on this
 * plugin's fiber, so unloading removes the key.
 * @param ctx - registrant context carrying the projection registry.
 */
export function apply(ctx: Context): void {
  ctx.sessionProjections.register(requestRouteProjectionDefinition)
}
