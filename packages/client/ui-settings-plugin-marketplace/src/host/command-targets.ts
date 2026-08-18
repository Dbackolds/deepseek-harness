/** Names `/reload` and `/update` can complete. */

import { isSkeletonEntry } from './reload.ts'

export interface CommandReloadTarget {
  readonly id: string
  readonly moduleName: string
}

export interface CommandUpdateTarget {
  readonly name: string
}

export interface CommandTargets {
  readonly reload: readonly CommandReloadTarget[]
  readonly update: readonly CommandUpdateTarget[]
}

export function listReloadTargets(
  entries: readonly { readonly id: string; readonly moduleName: string; readonly enabled: boolean }[],
): readonly CommandReloadTarget[] {
  const seen = new Set<string>()
  const targets: CommandReloadTarget[] = []
  for (const entry of entries) {
    if (!entry.enabled || isSkeletonEntry(entry.id, entry.moduleName)) continue
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    targets.push({ id: entry.id, moduleName: entry.moduleName })
  }
  return targets
}

export function listUpdateTargets(dependencies: readonly string[]): readonly CommandUpdateTarget[] {
  return [...dependencies].sort((left, right) => left.localeCompare(right)).map(name => ({ name }))
}
