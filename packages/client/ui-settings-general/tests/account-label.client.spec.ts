import { describe, expect, it } from 'vitest'
import { accountInitial, accountNameFromHome } from '../src/client/account-label.ts'

describe('accountNameFromHome', () => {
  it('takes the last POSIX home segment', () => {
    expect(accountNameFromHome('/Users/cat7street')).toBe('cat7street')
    expect(accountNameFromHome('/home/fixture/')).toBe('fixture')
  })

  it('takes the last Windows home segment', () => {
    expect(accountNameFromHome('C:\\Users\\alice')).toBe('alice')
    expect(accountNameFromHome('C:\\Users\\bob\\')).toBe('bob')
  })

  it('returns undefined for missing, empty, or separator-only homes', () => {
    expect(accountNameFromHome(undefined)).toBeUndefined()
    expect(accountNameFromHome('')).toBeUndefined()
    expect(accountNameFromHome('/')).toBeUndefined()
    expect(accountNameFromHome('\\')).toBeUndefined()
    expect(accountNameFromHome('.')).toBeUndefined()
    expect(accountNameFromHome('..')).toBeUndefined()
  })
})

describe('accountInitial', () => {
  it('uppercases the first grapheme', () => {
    expect(accountInitial('cat7street')).toBe('C')
    expect(accountInitial('本地')).toBe('本')
    expect(accountInitial('')).toBe('?')
  })
})
