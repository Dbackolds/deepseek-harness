import { describe, expect, it } from 'vitest'
import { isGithubHttpsUrl } from '../src/github-url.ts'

describe('isGithubHttpsUrl', () => {
  it('accepts only https://github.com/...', () => {
    expect(isGithubHttpsUrl('https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v1.2.4')).toBe(true)
    expect(isGithubHttpsUrl('http://github.com/deepseek-ai/deepseek-harness')).toBe(false)
    expect(isGithubHttpsUrl('https://www.github.com/deepseek-ai/deepseek-harness')).toBe(false)
    expect(isGithubHttpsUrl('https://github.example/deepseek-ai/deepseek-harness')).toBe(false)
    expect(isGithubHttpsUrl('https://github.com.evil.test/x')).toBe(false)
    expect(isGithubHttpsUrl('not-a-url')).toBe(false)
  })
})
