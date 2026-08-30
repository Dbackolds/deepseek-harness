# Agent Note: Opening-a-pull-request cookbook

Status: implemented

English | [中文](2026-08-30-opening-a-pull-request-cookbook.zh.md)

## Problem

Pull-request policy is enforced by Issue policy, label taxonomy, testing, documentation pairing, stack landing, and GUI evidence, but those owners live in separate notes, skills, and workflow files. Contributors opening a pull request had no one procedure that named the required Issue citation, labels, same-change evidence, local checks, and history rules without restating each owner.

The root README is the product entry point and already links contribution and development. Without that link, the new cookbook is discoverable only from cookbook filenames.

## Decision

[`docs/cookbook/opening-a-pull-request.md`](../../../../docs/cookbook/opening-a-pull-request.md) is the maintainer and agent checklist for opening, labeling, evidencing, and landing a pull request. It does not accept external contributions; that remaining closed-door fact stays in [`CONTRIBUTING.md`](../../../../CONTRIBUTING.md).

The cookbook cites live owners rather than copying their inventories: Issue policy and the pull-request template for citation and body shape, the [label taxonomy](2026-08-08-unified-github-label-taxonomy.md) for `kind/*` and `area/*`, Agent Notes / testing / GUI GIF / pairing for same-change evidence, [dsh-pre-push-checks](../../../skills/dsh-pre-push-checks/SKILL.md) for local checks, and [native stacks](2026-08-02-native-github-stacks-and-optional-rebases.md) plus the [stack review cookbook](../../../../docs/cookbook/responding-to-pr-review-on-a-stack.md) for history and review-fix placement.

The root README Contributing section and the development guide link that cookbook. The documentation website Cookbook section publishes the pair. The pull-request template and the stack-review cookbook point at it so the entry is reachable from the surfaces people already open.

## Alternatives considered

**Put the full checklist in `CONTRIBUTING.md`.** That file is the community-facing closed-door notice. Expanding it into maintainer procedure would mix audiences and bury the current "external pull requests are not accepted" fact.

**Put the checklist only in root `AGENTS.md`.** Agent standing orders stay one to three lines plus a link. A procedure with Issue citation, labels, evidence, and landing steps belongs in a cookbook.

**Leave discovery to cookbook filenames.** A contributor who starts at the README or GitHub pull-request form would not find the checklist. The README, development guide, template, and stack-review cookbook are the existing entry points.

## Consequences

Maintainers and agents have one procedure for a ready-for-review human pull request. Policy changes still land in their owning workflow, taxonomy note, or skill; the cookbook updates in the same change when those required steps change. Community readers still hit `CONTRIBUTING.md` first and are not invited to open a pull request this repository will not accept.
