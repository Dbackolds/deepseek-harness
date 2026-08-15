/**
 * Package-owned invariant companion for the user system-prompt library.
 *
 * Settings validation owns every mutable value before assembly can observe it.
 * The empty installer keeps that absence explicit in composed invariant sets.
 *
 * @module @deepseek-ai/dsh-user-system-prompts/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-user-system-prompts'

/** Cordis companion plugin name. */
export const name = 'user-system-prompts-invariant'
/** Services required before the companion can register. */
export const inject = ['invariants']

/** No runtime invariant: settings validation owns the only mutable-value relationship. */
const install: InvariantInstaller = () => {}

/**
 * Register the intentionally empty invariant contribution.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
