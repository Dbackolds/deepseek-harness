/**
 * Helpers shared by the Host marketplace and the browser settings row.
 */

export function formatReloadFinished(ok: number, failed: number): string {
  if (failed === 0) return `重载完成, 成功重载 ${String(ok)} 个插件`
  return `重载完成, 成功重载 ${String(ok)} 个插件, 失败 ${String(failed)} 个`
}

export function parseTagInput(raw: string): string[] {
  return normalizeTags(raw.split(/[,，]/))
}

export function allTags(notes: Record<string, { readonly tags: readonly string[] }> | undefined): string[] {
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

function normalizeTags(raw: readonly string[]): string[] {
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
