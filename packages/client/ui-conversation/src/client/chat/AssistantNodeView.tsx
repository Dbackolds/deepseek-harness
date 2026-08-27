import { memo, useMemo } from 'react'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { AssistantRouteOwnerProps, ChatNodeViewProps, TurnTailOwnerProps } from '../contract/slots.ts'
import { AssistantMarkdown } from './AssistantMarkdown.tsx'

type AssistantNodeViewProps =
  ChatNodeViewProps<'assistant-step'> & PropsRenderSlots<'conversation.chat.assistantRoute'>

/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export const AssistantNodeView = memo(function AssistantNodeView({
  node, useTurnData, openFile, renderMessageImages, fileMentions, renderSlot, t,
}: AssistantNodeViewProps) {
  const data = node.data
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])
  const mentions = useMemo(
    () => owner === undefined ? undefined : fileMentions(owner),
    [fileMentions, owner],
  )
  const requestConfig = data.requestConfig
  const provenance = data.finalNode?.provenance
  // The model line mounts only when the fold derived some per-step identity;
  // an undefined/absent occupant render stays a no-op under the clock.
  const route = useMemo(() => {
    if (requestConfig === undefined && provenance === undefined) return undefined
    return renderSlot('conversation.chat.assistantRoute', {
      ...(requestConfig === undefined ? {} : { requestConfig }),
      ...(provenance === undefined ? {} : { provenance }),
    } satisfies AssistantRouteOwnerProps)
  }, [renderSlot, requestConfig, provenance])
  return (
    <AssistantMarkdown
      blocks={data.blocks}
      streaming={data.status === 'running'}
      interrupted={data.status === 'interrupted'}
      time={data.time}
      renderMessageImages={renderMessageImages}
      mentions={mentions}
      route={route}
      t={t}
    />
  )
})
