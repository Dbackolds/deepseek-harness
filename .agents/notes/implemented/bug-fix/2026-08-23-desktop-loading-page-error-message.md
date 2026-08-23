# Agent Note: Desktop loading page carries Host launch errors

Status: implemented

English | [中文](2026-08-23-desktop-loading-page-error-message.zh.md)

## Problem

`presentWindow` still passes the Host launch error into `loadingPage(variant, message)`. `loadingPage` only accepted a title-bar variant, so `apps/desktop` typecheck failed and a failed Host start could not paint the error on the loading page.

## Decision

`loadingPage` takes an optional second argument. Omitted or empty text keeps `正在启动 DeepSeek Harness…`. Any other string is HTML-escaped and replaces that copy inside `.dsh-desktop-loading`.

## Alternatives considered

**Keep the one-argument page and splice the error with `String.replace`.** Rejected: the starting copy is not a stable contract, and a Host message that contains markup would land unescaped.

**Drop the error argument from `main.ts`.** Rejected: a failed Host start would leave the operator on the generic starting page with no diagnostic.

## Consequences

Desktop typecheck and pack can compile `main.ts`. A Host spawn or boot failure shows the escaped error instead of the starting copy.

## Testing

- `apps/desktop/tests/titlebar.spec.ts` asserts an HTML-bearing Host error is escaped and replaces the starting copy; an empty message keeps the starting copy.
