import type {
  AssistantBlock, AssistantMessageNode, AssistantRequestConfig, ChatConversationViewNode,
  CommandNode, CompactionSummaryNode, ConversationLocation, ModelRetryNode, RunningToolCall,
  ToolCallBlock,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Merge-extensible payload registry keyed by final Chat renderer kind. */
export interface ChatNodeDataMap {}

/** Renderer kinds contributed by the currently installed Chat business modules. */
export type ChatNodeKind = Extract<keyof ChatNodeDataMap, string>

/** Final Chat Node narrowed to one registered renderer kind and payload. */
export type ChatNode<Kind extends ChatNodeKind = ChatNodeKind> = {
  [RegisteredKind in Kind]: ChatConversationViewNode & {
    readonly kind: RegisteredKind
    readonly data: ChatNodeDataMap[RegisteredKind]
  }
}[Kind]

/** Final Assistant row payload shared by streaming and settled states. */
export interface AssistantChatData {
  readonly status: 'running' | 'settled' | 'interrupted'
  readonly turn: number
  readonly step: number
  readonly blocks: readonly AssistantBlock[]
  readonly time: number
  readonly usage?: unknown
  readonly finalNode?: AssistantMessageNode
  /**
   * Config of the request/header governing this step, stamped by the Chat
   * snapshot builder's step-keyed join (exact step header first, else the
   * latest header that predates the step). Undefined while no header in the
   * loaded window governs the step.
   */
  readonly requestConfig?: AssistantRequestConfig
}

/**
 * Hidden request/header carrier node for the Chat fold: one per logged
 * header, holding the call configuration the snapshot builder joins onto
 * assistant steps. Never rendered — visibility stays `hidden`.
 */
export interface ChatRequestHeaderChatData {
  /** Sequence of the governing `request/header` event. */
  readonly seq: number
  /** Provider/model and sampling configuration from the logged header. */
  readonly config: AssistantRequestConfig
  /** Location the fold resolved for the header event (its owning step, when any). */
  readonly location: ConversationLocation
}

/** Settled or interrupted Assistant payload with its durable presentation node. */
export type FinalAssistantChatData = AssistantChatData & {
  readonly finalNode: AssistantMessageNode
}

/** Root Tool row payload; the root lifecycle owns all recursive subcalls. */
export interface ToolChatData {
  readonly root: ToolCallBlock
}

/** One manual command and its correlated compaction transaction. */
export interface ManualCompactionChatData {
  readonly command: CommandNode
  readonly compaction: CompactionSummaryNode | null
}

/** One durable retry chain rendered as a single row. */
export interface RetryChatData {
  readonly attempts: readonly ModelRetryNode[]
  readonly current: ModelRetryNode
}

/** Turn-local footer row that owns actions and optional feature contributions. */
export interface TurnTailChatData {
  readonly turn: number
  readonly seq: number
  readonly time: number
  /** Last finalized content-bearing Assistant in this Turn. */
  readonly closing: FinalAssistantChatData | null
  /** Whether non-rendered later evidence makes the closing seq non-tail. */
  readonly branchUnavailable: boolean
  readonly ttftMs?: number
  readonly tokensPerSecond?: number
}

/**
 * Test whether a Tool root has settled.
 * @param block - Tool root lifecycle value.
 * @returns whether the root carries its final result.
 */
export function isSettledTool(block: ToolCallBlock): block is Extract<ToolCallBlock, { kind: 'tool-result' }> {
  return 'kind' in block
}

/**
 * Test whether a Tool root is still running.
 * @param block - Tool root lifecycle value.
 * @returns whether the root lacks a final result.
 */
export function isRunningTool(block: ToolCallBlock): block is RunningToolCall {
  return !isSettledTool(block)
}
