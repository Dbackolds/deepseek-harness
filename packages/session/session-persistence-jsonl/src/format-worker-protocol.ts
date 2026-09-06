/** Private messages for the JSONL backend's format computation thread. @module */
import type { JsonlCurrentGeneration, JsonlDecodedGeneration } from './generation.ts'

/** One catalog operation; the host admits only one request at a time. */
export interface FormatWorkerRequest {
  readonly operation: 'migrate' | 'validate'
  readonly value: JsonlDecodedGeneration
}

/** Catalog failures retain the classification used by the persistence provider. */
export type FormatWorkerReply =
  | { readonly kind: 'result'; readonly value: JsonlCurrentGeneration | undefined }
  | { readonly kind: 'error'; readonly unsupported: boolean; readonly error: Error }
