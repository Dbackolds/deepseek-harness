# Agent Note: Edit text of mixed-content queued messages

Status: implemented

English | [中文](2026-08-19-queued-mixed-content-text-edit.zh.md)

## Problem

Web QueueDock already edits a still-pending ordinary-session occurrence in place. A row that also carries an admitted image was treated as non-editable: the client projected `text: null`, disabled the edit control, and `session.updateQueue` replaced the whole content with the edit payload. Saving that payload would drop the image, so mixed-content rows could only be deleted or steered.

Users still need to change the caption of a queued image message before the driver claims it. Re-queuing from the composer cannot address that occurrence, and deleting then resending can reorder FIFO or lose the already-admitted attachment.

## Decision

`session.updateQueue` edit accepts exactly one text block. The host replaces every existing text block with that text and keeps already-admitted non-text blocks, including images, in their original order. An image-only occurrence receives one trailing text block. An empty payload or a payload that contains a non-text block still returns `attachment-error` with `QUEUE_EDIT_NON_TEXT`, so the edit path cannot inject a new image past prompt admission.

The client queue projection concatenates existing text blocks into `text` for every row. QueueDock enables the same inline editor on mixed-content rows and still sends one text block. The next authoritative `session/queue` snapshot is the visible commit. Addressed subagent rows stay read-only.

## Alternatives considered

**Keep mixed-content rows read-only.** Rejected because the user can already delete or steer the occurrence; refusing a caption change forces a delete-and-resend that can reorder FIFO or drop the admitted image.

**Send the complete mixed content from the browser.** Rejected because the queue editor is a single text field and the browser must not re-admit or reconstruct durable image blocks. The host already owns those blocks.

**Open a second image-editing surface in QueueDock.** Rejected as out of scope: the request is to change the queued text, not to add, remove, or replace attachments.

## Consequences

A queued image keeps its admitted attachment when its caption changes. Multiple original text blocks collapse to one block at the first text position. Clearing the caption cannot be saved while the editor still requires non-blank text, matching the existing text-only save rule.

## Testing

Host proxy tests pin a mixed-content edit that keeps the image, an image-only edit that appends text, and a non-text payload that remains `QUEUE_EDIT_NON_TEXT`. Runtime projection tests pin mixed-content `text` as the concatenated caption. QueueDock tests pin an enabled mixed-content edit control and a save that sends one text block.

## Related

Image admission and the prohibition on injecting images through queue edit remain owned by [Web multimodal image input and durable attachments](2026-07-22-web-multimodal-image-input-and-durable-attachments.md). Per-row addressability remains owned by [Address pending queue occurrences for edit and removal](../../archived/feature/2026-07-29-addressable-queue-operations.md).
