/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-settings-plugin-marketplace`.
 * @module @deepseek-ai/dsh-client-ui-settings-plugin-marketplace/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-settings-plugin-marketplace'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-plugin-marketplace-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the Host half projects Loader, settings, and profile
 * state it does not own, and the browser half is a settings surface with no
 * event stream of its own.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
