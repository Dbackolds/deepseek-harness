/**
 * The session header's model-identity label: a read-only chip naming the
 * route of the LAST DISPATCHED request (the `requestRoute` projection's
 * latest-wins fold of `request/header` events), rendered beside the
 * agent-preset label.
 *
 * Read-only by construction, same as AgentPresetLabel: the header reports
 * what the session already ran, never what the composer's selector stages —
 * changing the selector without sending leaves this untouched, and a session
 * with no dispatched request paints nothing. The directory load is primed at
 * mount so catalog display names resolve without opening the composer menu;
 * a catalog miss degrades to the raw model id.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the header actions seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: merges the requestRoute key into SessionProjectionMap for useProjection.
import type {} from '@deepseek-ai/dsh-session-route/client'
import type { ModelDirectoryState } from './directory.ts'
import { resolveRouteLabel } from './route-label.ts'
import css from './ModelIdentityLabel.module.css'

/** Registration-side business face for the header identity label. */
export interface ModelIdentityLabelInjected {
  hooks: {
    /** The session's shared directory store, bound by the renderer as useDirectory. */
    directory: SnapshotStore<ModelDirectoryState>
  }
  /** Prime the directory load (fire-and-forget; errors land on the store). */
  load: () => void
}

/** Full component props. */
export type ModelIdentityLabelProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'model'>
  & InjectFace<ModelIdentityLabelInjected>

/**
 * Render the last dispatched request's model identity beside the session title.
 * @param props - composed slot props.
 * @returns the label chip, or null while no request has been dispatched.
 */
export function ModelIdentityLabel({ useProjection, useDirectory, load, t }: ModelIdentityLabelProps) {
  const route = useProjection('requestRoute')
  const groups = useDirectory(state => state.groups)

  // Mount-time load resolves the display names without opening the composer
  // menu (the composer seat primes the same shared directory; this makes the
  // header self-sufficient). The injected face is cached per session scope,
  // so this fires once per mount, not per render.
  useEffect(() => { load() }, [load])

  // null = the log holds no request header yet; undefined = the projection
  // capability is absent (session-route host unit not composed). Both paint
  // nothing — a blank session carries no identity worth claiming.
  if (route === null || route === undefined) return null

  const label = resolveRouteLabel({ groups }, route.provider, route.model, route.reasoningEffort)
  return (
    <span
      className={css.label}
      title={t('identity.title', { route: `${route.provider} / ${route.model}` })}
    >
      <span className={css.name}>{label.name}</span>
      {label.effort !== undefined && <span className={css.effort}>{`· ${label.effort}`}</span>}
    </span>
  )
}
