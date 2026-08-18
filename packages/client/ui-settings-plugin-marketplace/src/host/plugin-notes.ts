/** Local notes and tags attached to installed plugins. */

export interface PluginNote {
  readonly note: string
  readonly tags: readonly string[]
}

export type PluginNotes = Record<string, PluginNote>

export function emptyNote(): PluginNote {
  return { note: '', tags: [] }
}

export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of raw) {
    const tag = item.trim()
    if (tag.length === 0) continue
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export function parseTagInput(raw: string): string[] {
  return normalizeTags(raw.split(/[,，]/))
}

export function isPluginNotes(value: unknown): value is PluginNotes {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every(isPluginNote)
}

function isPluginNote(value: unknown): value is PluginNote {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.note === 'string' && Array.isArray(row.tags) && row.tags.every(tag => typeof tag === 'string')
}

export function noteOf(notes: PluginNotes | undefined, packageName: string): PluginNote {
  return notes?.[packageName] ?? emptyNote()
}

export function writeNote(
  notes: PluginNotes | undefined,
  packageName: string,
  next: { readonly note: string; readonly tags: readonly string[] },
): PluginNotes {
  const note = next.note.trim()
  const tags = normalizeTags(next.tags)
  const current = { ...(notes ?? {}) }
  if (note.length === 0 && tags.length === 0) {
    return Object.fromEntries(Object.entries(current).filter(([name]) => name !== packageName))
  }
  return { ...current, [packageName]: { note, tags } }
}

export function allTags(notes: PluginNotes | undefined): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const item of Object.values(notes ?? {})) {
    for (const tag of item.tags) {
      const key = tag.toLocaleLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags.sort((left, right) => left.localeCompare(right))
}
