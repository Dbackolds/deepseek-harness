import type { SkillCatalogEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { SkillsSettingsKey } from './locales.ts'

/** Known filesystem and bundled origin buckets. */
const SOURCE_KEYS = {
  bundled: 'sourceBundled',
  runtime: 'sourceRuntime',
  'user-dsh': 'sourceUserDsh',
  'user-agents': 'sourceUserAgents',
  'project-dsh': 'sourceProjectDsh',
  'project-agents': 'sourceProjectAgents',
  'project-codex': 'sourceProjectCodex',
  'project-claude': 'sourceProjectClaude',
  custom: 'sourceCustom',
} as const satisfies Record<string, SkillsSettingsKey>

/**
 * Locale key for a known origin bucket, or undefined so the page shows the
 * raw source string from an out-of-tree provider.
 * @param source - catalog origin bucket.
 * @returns the matching locale key, or undefined for an unknown bucket.
 */
export function sourceLabelKey(source: string): SkillsSettingsKey | undefined {
  return Object.hasOwn(SOURCE_KEYS, source)
    ? SOURCE_KEYS[source as keyof typeof SOURCE_KEYS]
    : undefined
}

/**
 * Whether a catalog row matches the local search query.
 * @param skill - one catalog row.
 * @param normalizedQuery - trimmed, lowercased query.
 * @returns whether name, description, source, or provider contains the query.
 */
export function matchesSkill(skill: SkillCatalogEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [skill.name, skill.description, skill.source ?? '', skill.provider ?? '', skill.whenToUse ?? '']
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}
