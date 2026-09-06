/** Run with node --import tsx/esm; optionally pass a baseline module path. */
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import * as optimized from '../src/index.ts'

const baselinePath = process.argv[2]
const baseline = baselinePath === undefined ? undefined : await import(pathToFileURL(baselinePath).href) as typeof optimized
const rows = Array.from({ length: 20_000 }, (_, index) => ({
  type: 'tool/result', index, content: [{ type: 'text', text: 'x'.repeat(128) }],
  metadata: { completed: true, duration: index },
}))
const samples = 7
for (const [label, api] of [['baseline', baseline], ['optimized', optimized]] as const) {
  if (api === undefined) continue
  for (const operation of ['isJsonValue', 'snapshotJsonValue'] as const) {
    api[operation](rows)
    const timings: number[] = []
    for (let sample = 0; sample < samples; sample++) {
      const start = performance.now()
      api[operation](rows)
      timings.push(performance.now() - start)
    }
    timings.sort((a, b) => a - b)
    console.log(JSON.stringify({ label, operation, rows: rows.length, medianMs: timings[Math.floor(samples / 2)] }))
  }
}
