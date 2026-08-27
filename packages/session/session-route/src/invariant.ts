/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-session-route`.
 * @module @deepseek-ai/dsh-session-route/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-session-route'

/** Cordis companion plugin name. */
export const name = 'session-route-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package owns a single pure latest-wins fold whose
 * wire payload is schema-validated by the projection registry at every
 * snapshot and change-feed emission, and the event relations the fold relies
 * on are owned elsewhere — dsh-session validates every `request/header`
 * snapshot at the seed/load boundary (provider/model present, non-empty
 * effort, canonical optional fields) and dsh-agent-loop is the one legitimate
 * live writer, appending canonical headers only when the held one differs or
 * per loop-instance first dispatch. A duplicate or out-of-order header cannot
 * mislead the fold: latest wins is the whole semantic.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
