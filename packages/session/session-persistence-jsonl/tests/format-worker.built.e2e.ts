import { execFile, type ExecFileException } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SESSION_FORMAT_VERSION, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { releasedV1OneTurnLog } from '../../session-persistence/tests/contract.ts'
import { generationLogPath } from '../src/format.ts'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const builtIndex = join(packageRoot, 'lib/index.js')
const builtWorker = join(packageRoot, 'lib/format-worker.js')
const require = createRequire(new URL('../package.json', import.meta.url))

describe.skipIf(!existsSync(builtIndex) || !existsSync(builtWorker))('built JSONL format worker', () => {
  it('migrates history under plain Node from an unrelated working directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-jsonl-built-worker-'))
    try {
      const storageRoot = join(root, 'sessions')
      const id = SessionId('built-worker-history')
      const predecessor = generationLogPath(storageRoot, undefined, id, 0, 'none')
      await mkdir(dirname(predecessor), { recursive: true })
      const original = [
        { type: 'session', version: 0, id, createdAt: 1000, delegationDepth: 0 },
        ...releasedV1OneTurnLog(),
      ].map(value => JSON.stringify(value)).join('\n') + '\n'
      await writeFile(predecessor, original)
      const driver = join(root, 'driver.mjs')
      await writeFile(driver, `
import { Context } from ${JSON.stringify(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)}
import JsonlSessionPersistence from ${JSON.stringify(pathToFileURL(builtIndex).href)}
const ctx = new Context()
try {
  await ctx.plugin(JsonlSessionPersistence, { root: ${JSON.stringify(storageRoot)}, compression: 'none' })
  const handle = await ctx.sessionPersistence.open(${JSON.stringify(id)}, 'read')
  try {
    const rows = await handle.read()
    if (rows.length !== 6 || rows.some(row => row.type === 'assistant/chunk')) {
      throw new Error('history did not migrate to compact current events')
    }
    console.log('jsonl-built-worker-ok')
  } finally {
    await handle.close()
  }
} finally {
  await ctx.fiber.dispose()
}
`)
      const result = await new Promise<{ error: ExecFileException | null; stdout: string; stderr: string }>((resolve) => {
        execFile(process.execPath, [driver], { cwd: root, timeout: 90_000, encoding: 'utf8' }, (error, stdout, stderr) => {
          resolve({ error, stdout, stderr })
        })
      })
      expect(result.error?.killed, result.stderr).not.toBe(true)
      expect(result.error?.signal, result.stderr).toBeFalsy()
      expect(result.error, result.stderr).toBeNull()
      expect(result.stdout).toContain('jsonl-built-worker-ok')
      expect(await readFile(predecessor, 'utf8')).toBe(original)
      const successor = generationLogPath(storageRoot, undefined, id, SESSION_FORMAT_VERSION, 'none')
      expect(JSON.parse((await readFile(successor, 'utf8')).split('\n')[0]!)).toMatchObject({
        version: SESSION_FORMAT_VERSION, id,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
