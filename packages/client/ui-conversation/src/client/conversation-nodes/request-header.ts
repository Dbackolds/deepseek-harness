import type { Context } from '@deepseek-ai/cordis'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChatRequestHeaderChatData } from '../contract/chat-nodes.ts'
import { chatNode } from './common.ts'

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ChatNodeDataMap {
    /** Hidden per-header carrier joined onto assistant steps as requestConfig. */
    'chat-request-header': ChatRequestHeaderChatData
  }
}

/**
 * Hidden request/header carrier for the Chat fold: one Context per logged
 * header keeping the call configuration the snapshot builder joins onto
 * assistant steps. The node never renders — the chat flow only lists visible
 * nodes — it exists so the join reads durable log data, mirroring the
 * Trajectory target's request-header Definition without importing it.
 */
export const chatRequestHeaderDefinition: ConversationNodeDefinition<ChatRequestHeaderChatData> = {
  kind: 'chat-request-header',
  target: 'chat',
  match: event => event.type === 'request/header'
    ? { id: String(event.seq), role: 'start' }
    : null,
  start: (_context, match) => {
    if (match.event.type !== 'request/header') {
      throw new Error('chat-request-header start requires request/header')
    }
    return {
      seq: match.event.seq,
      config: match.event.data.header.config,
      location: match.location,
    }
  },
  update: context => context.state,
  buildViewNode: context => context.state === undefined
    ? null
    : chatNode(context, 'chat-request-header', context.state.seq, context.state, {
      visibility: 'hidden',
    }),
}

/**
 * Register the hidden Chat request-header carrier.
 * @param ctx - owning UI Conversation context.
 */
export function registerRequestHeaderConversationNode(ctx: Context): void {
  ctx.conversationEvents.register(chatRequestHeaderDefinition)
}
