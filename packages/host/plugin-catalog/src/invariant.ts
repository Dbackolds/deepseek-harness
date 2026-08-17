/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-plugin-catalog`.
 * @module @deepseek-ai/dsh-host-plugin-catalog/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-plugin-catalog'

/** Cordis companion plugin name. */
export const name = 'host-plugin-catalog-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: the only owned relation is the named catalog route,
 * whose register/release symmetry is covered by the package's
 * real-composition HMR-safety test. The webserver companion already probes
 * route disposer symmetry process-wide.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
