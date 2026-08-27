/**
 * The `requestRoute` projection unit: a pure latest-wins fold of
 * `request/header` events over the whole session log into the dispatched
 * request route — the provider/model/reasoning-effort identity the surface
 * presents as "which model is serving this session".
 *
 * `request/header` snapshots are whole values: the loop appends one inside
 * the step before every dispatch whose header differs from the held one
 * (plus the first of each loop instance), so replay order alone decides the
 * result — the newest snapshot's `config` triple IS the current route, and
 * `reason` (`'initial'`/`'resume'`/`'change'`) never changes what is served.
 * This mirrors `foldRequestHeader` in dsh-session (the same latest-wins
 * reconstruction over the same events) but keeps only the identity fields,
 * never the prompt or tool schemas: the unit answers "which route", not
 * "what was sent".
 *
 * A route equal to the folded one (a resume re-logging the same header after
 * a restart) returns the SAME state reference, so the registry's change feed
 * stays silent — Object.is gates downstream work, exactly as in the
 * token-usage fold.
 *
 * @module @deepseek-ai/dsh-session-route/projection
 */

import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { RequestRouteProjection } from './types.ts'

/**
 * The wire (and persisted-state) shape: non-empty provider/model, a non-empty
 * optional effort, or `null` before the first header. The transform emits the
 * exact-optional object (no explicit-undefined key), the same shape contract
 * the context-pressure view holds under `exactOptionalPropertyTypes`.
 */
const requestRouteSchema: z.ZodType<RequestRouteProjection | null> = z.union([
  z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    reasoningEffort: z.string().min(1).optional(),
  }).strict(),
  z.null(),
]).transform(route => route === null
  ? null
  : {
    provider: route.provider,
    model: route.model,
    ...route.reasoningEffort === undefined ? {} : { reasoningEffort: route.reasoningEffort },
  },
)

/** The `requestRoute` unit registered on `ctx.sessionProjections` (exported for the unit spec). */
export const requestRouteProjectionDefinition = {
  key: 'requestRoute',
  stateVersion: 1,
  stateSchema: requestRouteSchema,
  init: () => null,
  apply: (state, event) => {
    if (event.type !== 'request/header') return state
    const { provider, model, reasoningEffort } = event.data.header.config
    const route: RequestRouteProjection = {
      provider,
      model,
      ...reasoningEffort === undefined ? {} : { reasoningEffort },
    }
    return state !== null
      && state.provider === route.provider
      && state.model === route.model
      && state.reasoningEffort === route.reasoningEffort
      ? state
      : route
  },
  wire: { viewSchema: requestRouteSchema, view: state => state },
} satisfies ProjectionDefinition<'requestRoute', RequestRouteProjection | null>
