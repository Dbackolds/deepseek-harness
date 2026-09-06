/** Catalog computation isolated from the host event loop; never publishes files. @module */
import { parentPort } from 'node:worker_threads'
import { sessionFormatCatalog, SessionFormatUnsupportedMigrationError } from '@deepseek-ai/dsh-session-format-catalog'
import type { FormatWorkerReply, FormatWorkerRequest } from './format-worker-protocol.ts'

if (parentPort === null) throw new Error('JSONL format worker requires a parent message port')
const port = parentPort
port.on('message', (request: FormatWorkerRequest) => {
  let reply: FormatWorkerReply
  try {
    if (request.operation === 'migrate') {
      const source = sessionFormatCatalog.decodeRecoverableArtifact(request.value.header, request.value.rows)
      const current = sessionFormatCatalog.migrate(source)
      reply = { kind: 'result', value: sessionFormatCatalog.encodeCurrent(current) }
    } else {
      const current = sessionFormatCatalog.decodeArtifact(request.value.header, request.value.rows)
      sessionFormatCatalog.migrate(current)
      reply = { kind: 'result', value: undefined }
    }
  } catch (error: unknown) {
    reply = {
      kind: 'error',
      unsupported: error instanceof SessionFormatUnsupportedMigrationError,
      error: error instanceof Error ? error : new Error('format catalog threw a non-Error value', { cause: error }),
    }
  }
  port.postMessage(reply)
})
