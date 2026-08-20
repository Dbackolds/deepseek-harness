# Agent Note: Session list accepts automation origin

Status: implemented

English | [中文](2026-08-19-session-list-accepts-automation-origin.zh.md)

## Problem

`SessionHeader.origin` and `SessionSummary.origin` already include `automation` for Host-scheduled Sessions. The client Zod parse for `session.list` and `host/session-added` accepted only `subagent`. One automation row therefore failed the whole list value, and the Workspace browser rendered every group with no Session rows.

## Decision

`sessionOriginSchema` is the shared `subagent | automation` parse used by `sessionSummarySchema` and `host/session-added`. An unknown tag still fails that one field. A mixed list that includes a valid automation row now parses.

## Alternatives considered

**Strip `origin` from automation rows on the Host.** Rejected: the durable header already carries the tag, and navigation surfaces need it to distinguish scheduled Sessions from ordinary ones.

**Fail soft on an unknown `origin` and keep the rest of the list.** Rejected: the carrier parse is the typed same-process check for this wire value. Dropping one field would hide a schema drift until a later consumer read it.

## Consequences

A corpus that includes scheduled Sessions keeps every ordinary Session visible. An unknown origin still fails the list parse rather than silently dropping that row.

## Testing

- `packages/host/apiproxy/tests/rpc-schemas.spec.ts` accepts `subagent` and `automation` on a summary and on `host/session-added`, accepts a mixed `session.list` value, and rejects `fork`.
