/**
 * The per-step model line under an assistant narration's clock
 * (`conversation.chat.assistantRoute`): one muted text span naming the model
 * that served THAT step. Identity prefers the message's own provenance
 * (`assistant/message.source` — what actually served), falling back to the
 * governing request header's config; the effort segment always comes from the
 * header's logged `reasoningEffort`. Placement and the muted tone are owned
 * by ui-conversation's render site — this component contributes only the
 * label content, so an unoccupied or identity-less step costs no layout.
 */

import { useEffect } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (the assistantRoute seat
// and its requestConfig/provenance owner share).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ModelDirectoryState } from './directory.ts'
import { formatRouteLabel, resolveRouteLabel } from './route-label.ts'

/** Registration-side business face for the per-step model line. */
export interface ModelRouteLineInjected {
  hooks: {
    /** The session's shared directory store, bound by the renderer as useDirectory. */
    directory: SnapshotStore<ModelDirectoryState>
  }
  /** Prime the directory load (fire-and-forget; errors land on the store). */
  load: () => void
}

/** Full component props. */
export type ModelRouteLineProps =
  PropsRuntime<'conversation.chat.assistantRoute'>
  & PropsLocale<'model'>
  & InjectFace<ModelRouteLineInjected>

/**
 * Render this step's model identity as one text span under the message clock.
 * @param props - composed slot props (owner shares from the chat node).
 * @returns the label text, or null when the step carries no identity.
 */
export function ModelRouteLine({
  requestConfig, provenance, useDirectory, load, t,
}: ModelRouteLineProps) {
  const groups = useDirectory(state => state.groups)

  // The header label (or the composer seat) primes the same per-session
  // directory this reads; this mount-time load is the belt-and-braces
  // refresher, cached per session scope so it fires once per mount.
  useEffect(() => { load() }, [load])

  // Provenance is the serving message's own report; the joined header config
  // is the fallback (a step whose message carried no source still names its
  // request). Neither share present → nothing to label.
  const identity = provenance ?? requestConfig
  if (identity === undefined) return null

  const label = resolveRouteLabel(
    { groups }, identity.provider, identity.model, requestConfig?.reasoningEffort,
  )
  return (
    <span title={t('identity.stepTitle', { route: `${identity.provider} / ${identity.model}` })}>
      {formatRouteLabel(label)}
    </span>
  )
}
