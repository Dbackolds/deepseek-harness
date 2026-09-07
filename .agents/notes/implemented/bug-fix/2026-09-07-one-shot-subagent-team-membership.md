# Agent Note: One-shot subagents are not implicit Team Leads

Status: implemented

English | [中文](2026-09-07-one-shot-subagent-team-membership.zh.md)

## Problem

A Team Lead can start a plain one-shot subagent, including the terminal Bugbot reviewer. That child is a direct Session with `parentSession` set and is not on the Team roster. `tryMembership` treated a non-roster direct child as a nested Lead unless a suffix `subagent/descriptor` already existed.

A one-shot in-process provider appends that descriptor inside `agent/pre-step` after the first prompt assembly. `agent/created` and that first assembly therefore see a child with origin `subagent` and no descriptor. Scoped Team tools install on the false Lead, and the next `team:policy` assembly throws `TEAM_NOT_MEMBER`, aborting the child's turn.

## Decision

Provider-owned subagents are not Team members. `tryMembership` classifies them by `SessionHeader.origin === 'subagent'` at publication. A suffix `subagent/descriptor` remains a fallback for logs that omit origin. Ordinary host forks still become independent roots because they are not provider-owned. Rostered teammates remain members through their durable `team/member` records.

The [Agent Teams identity decision](../feature/2026-08-05-agent-teams.md) still owns the implicit-root Team and the roster. This note owns only the origin-before-descriptor classification.

## Alternatives considered

**Wait until the descriptor exists before classifying the child.** Rejected: first prompt assembly already needs a correct membership, and one-shot providers write the descriptor only after that assembly.

**Treat every Agent with a live parent as a nested Lead.** Rejected: that is the failing classification. Provider-owned children share a parent Session with teammates and must not inherit Team tools.

**Move one-shot descriptor append into unpublished setup.** Rejected: the one-shot provider contract appends the descriptor inside the child's initial turn. Membership can use the header origin that already exists at publication.

## Consequences

Plain one-shot children keep the default catalog and complete their turns under a Team Lead. Teammates still receive scoped Team tools. A resumed provider-owned child without a live parent remains unclassified as a Team root.

## Testing

Roster tests cover a live one-shot child with origin and no descriptor, and a descriptor-only child without origin. Tool tests cover `agent/created` plus first-assembly: Team tools and `team:policy` stay off the one-shot child.
