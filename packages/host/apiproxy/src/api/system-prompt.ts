/**
 * systemPrompt domain contract: read-only listing of registered prompt
 * sections for the System prompts settings page. Writes stay on
 * `settings.replace` in the `user-system-prompts` namespace.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Wire view of one registered prompt section. */
export interface RegisteredPromptSectionView {
  /** Registry name (`harness:identity`, `tool:bash`, …). */
  name: string
  /** Concatenation order; lower values render first. */
  order: number
  /** Resolved (not interpolated) section text. */
  text: string
  /** Whether this contribution is a complete system prompt. */
  complete: boolean
}

/** System-prompt-domain unary methods (the map keys systemPrompt.* of RpcMethodMap). */
export interface SystemPromptApi {
  /**
   * List the Host's effective global registered prompt sections in
   * concatenation order. Scoped agent overlays are absent: the settings page
   * edits the deployment-wide registry, not one session's persona.
   */
  list(request: RpcRequest<{}>): Promise<RpcResponse<{ sections: RegisteredPromptSectionView[] }>>
}
