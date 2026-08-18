import { describe, it } from 'vitest'
import { allTags, noteOf, parseTagInput, writeNote } from '../../src/host/plugin-notes.ts'

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message)
}

assert(parseTagInput(' 核心 , UI，核心, ').join(',') === '核心,UI', 'tags trim, split, and dedupe')
const written = writeNote({}, 'plain-lib', { note: ' keep ', tags: ['核心', '核心'] })
assert(written['plain-lib']?.note === 'keep', 'note trims')
assert(written['plain-lib']?.tags.join(',') === '核心', 'duplicate tags collapse')
assert(noteOf(written, 'missing').note === '' && noteOf(written, 'missing').tags.length === 0, 'missing note is empty')
const listed = allTags(writeNote(written, 'other', { note: '', tags: ['UI', '工具'] }))
assert(listed.includes('UI') && listed.includes('核心') && listed.includes('工具') && listed.length === 3, 'all tags collected')
assert([...listed].sort((left, right) => left.localeCompare(right)).join(',') === listed.join(','), 'all tags sort')
assert(Object.keys(writeNote(written, 'plain-lib', { note: '  ', tags: [] })).length === 0, 'empty note is dropped')


describe('plugin-notes', () => {
  it('holds the imported assertions', () => {})
})
