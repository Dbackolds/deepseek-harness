/**
 * Shared display-name resolution for the two read-only route labels (the
 * session header's identity chip and the per-step clock line). Both render
 * `<name> · <effort>` in the composer trigger's shape, but from LOGGED
 * identity (the requestRoute projection / the chat fold's per-step shares),
 * never from the composer's selection state — the same one-way split as the
 * agent-preset label: the trigger chooses, the labels report.
 */
import type { ModelDirectoryState } from './directory.ts'

/** One resolved route identity for display. */
export interface RouteLabel {
  /** Catalog display name, or the raw model id when the catalog misses. */
  name: string
  /** Effort display name from the adapter vocabulary; undefined = no segment. */
  effort: string | undefined
}

/**
 * Resolve a logged provider/model identity (plus optional logged effort id)
 * against the session's directory snapshot, using the same lookup the
 * composer trigger performs (ModelSelect.tsx: groups → models → name, effort
 * name-by-id over `model.reasoning.efforts`). Catalog misses degrade to the
 * raw ids rather than hiding the identity: a route serving a model it
 * stopped advertising is missing from the groups yet perfectly real.
 *
 * @param state - the session's directory snapshot (names + effort vocabulary).
 * @param provider - logged provider route id.
 * @param model - logged provider-owned model id.
 * @param effortId - logged reasoning-effort id, when the header carried one.
 * @returns the display name and the effort label segment.
 */
export function resolveRouteLabel(
  state: Pick<ModelDirectoryState, 'groups'>,
  provider: string,
  model: string,
  effortId: string | undefined,
): RouteLabel {
  const found = state.groups
    .find(group => group.id === provider)
    ?.models.find(entry => entry.id === model)
  return {
    name: found?.name ?? model,
    effort: effortId === undefined
      ? undefined
      : found?.reasoning?.efforts.find(level => level.id === effortId)?.name ?? effortId,
  }
}

/**
 * Join a resolved label into the trigger's display string.
 * @param label - resolved identity.
 * @returns `<name> · <effort>`, or just the name when no effort segment.
 */
export function formatRouteLabel(label: RouteLabel): string {
  return label.effort === undefined ? label.name : `${label.name} · ${label.effort}`
}
