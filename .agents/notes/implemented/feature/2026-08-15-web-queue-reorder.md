# Agent Note: Reorder queued Web messages by drag

Status: implemented

English | [中文](2026-08-15-web-queue-reorder.zh.md)

## Problem

Queued messages resume in `next-turn` order after the current turn settles. Web could edit, remove, or strictly steer one exact occurrence, but the only way to change that order was to delete and retype. Adjacent up/down buttons cannot express an arbitrary destination, and a client-only reorder would lie about Host FIFO until the next snapshot arrived.

## Decision

`Inbox.move(messageId, beforeMessageId?)` relocates one still-pending identity inside its current list. Omitting the anchor appends at that list's end. A missing identity or an already-correct position is a no-op and writes no splice. An anchor from the other list throws. The durable event is one same-list `agent/inbox/spliced` replacement of the affected window, so observers reconstruct the new order from the splice rather than from a discarded-then-inserted pair.

`session.updateQueue` accepts `{ kind: 'move', beforeItemId? }` for a `next-turn` occurrence. The Host refuses a next-step identity and an unknown `beforeItemId` with `queue-item-not-found` and leaves both lists unchanged. A no-op move still answers `accepted: true`. QueueDock exposes HTML5 drag on two or more ordinary-session rows: dropping on another row's top or bottom half sends that move for the dragged occurrence. The client applies no optimistic reorder; the next `session/queue` snapshot is the visible commit. Addressed subagent rows stay read-only.

## Alternatives considered

**Adjacent up/down buttons only.** Rejected because an arbitrary destination would take N clicks and still hide the Host insert-before contract.

**Client-only reorder until the next snapshot.** Rejected because a claim or second client can win first; waiting for the Host snapshot keeps the same race as edit and remove.

**A whole-queue replace RPC.** Rejected because the existing per-item address already names the occurrence, and one splice already records the affected window.

**Allow moving a next-step item into Queue.** Rejected because Queue mutation stays queued-only; steering and injected context keep their own delivery contracts.

## Consequences

Admission order is no longer append-only. Cancel still preserves the current `next-turn` order, and whole-queue steer still walks the live snapshot sequentially, so a reorder that lands before a flush changes which occurrence steers first. Mixed-content rows remain movable because move forwards identity rather than text.

## Testing

Inbox tests pin same-list relocation, no-op identity and position, a cross-list throw, and the absence of discarded or inserted live notifications. Host schema and proxy tests pin the `move` action, an unknown `beforeItemId`, and a refused next-step identity. QueueDock tests pin an arbitrary drop, a no-op drop, and an undraggable single row. The keyless Web queue scenario reorders two preserved rows through the assembled HTTP/SSE composition before the wake prompt, so durable admission follows the new order.

## Related

Per-row edit, remove, and strict steer remain owned by [Address pending queue occurrences for edit and removal](../../archived/feature/2026-07-29-addressable-queue-operations.md) and [Steer a queued Web message into the active turn](../feature/2026-07-30-web-queue-steer-action.md). This note only adds same-list reorder on top of that address.
