# Agent Note: Long question titles scroll with the choices

Status: implemented

English | [中文](2026-08-30-question-composer-long-title-scroll.zh.md)

## Problem

The question composer caps the card at `min(60vh, 520px)` so footer actions stay on screen. The question title lived in a `flex-shrink: 0` header. A long prompt therefore consumed the cap before the scroll body received any height: the option list and custom-answer row sat at height 0, `scrollHeight === clientHeight`, and the user could neither scroll to the choices nor select them. The earlier row-shrink fix still holds for wrapped option copy; it does not cover a title that never enters the scroll body.

## Decision

The expanded card treats the question title as scroll content of `[data-question-scroll]`, alongside detail and the option list. Header chrome is the eyebrow plus the collapse and dismiss actions. Footer pager, skip, and submit stay outside the scroll region.

A collapsed card still shows the title in the header strip so the pending question remains identifiable. That title is line-clamped to two lines because collapse drops the height cap; an unclamped prompt would cover the conversation the collapse exists to reveal.

## Alternatives considered

**Give the header title its own `max-height` and `overflow-y: auto`.** Rejected because the choices still sit below that inner scroller. A prompt that fills the card cap still leaves the option list at height 0; the user would scroll the title without ever reaching an answer.

**Drop the card `max-height` so a long prompt can grow.** Rejected because the composer seat is a fixed-height conversation column with `overflow: hidden`. An uncapped card loses its own submit button, which is the failure the cap exists to prevent.

**Ellipsize the expanded title.** Rejected because the prompt is the decision the user is answering. Clamping belongs only to the collapsed strip, where the title is a reminder rather than the reading surface.

## Testing

The component spec requires the heading and the option rows to share `[data-question-scroll]`, and the skip action to stay outside it, including after a collapse/expand cycle. The assembled `question-composer` web e2e asks a wrapping title through the live user-questions seam at a capped viewport and requires a positive option-row height, a scrolling body, and a skip button that remains inside the card; the test then scrolls to the choice and submits it.

## Consequences

A long prompt no longer hides the answers. Short questions move the title onto the next row under the header actions, so the collapse and dismiss controls stay on a compact strip instead of floating beside a wrapping heading. Collapsed cards show at most two lines of the prompt.
