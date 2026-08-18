# Agent Note: Multi-Folder Workspace

Status: implemented

English | [中文](2026-08-15-multi-folder-workspace.zh.md)

## Problem

A Workspace is one canonical directory. Users who keep related trees in sibling folders — a product repo plus a shared library, a frontend plus a backend, a checkout plus generated assets — have to open a second Workspace, start a second Session, and lose a shared sandbox, instruction set, and conversation. Treating each extra folder as another Workspace also splits Session membership, because attach still requires `SessionHeader.cwd` to equal the Workspace path.

## Decision

Keep one primary `path` as the Session cwd and membership key. Persist additional folders on the same Workspace record as an ordered `folders` array of canonical directories. The primary path stays the create-time realpath and is never rewritten; additional folders never include that path; uniqueness is canonical-path equality across every Workspace's primary path and additional folders.

`Workspace.addFolder(path)` / `removeFolder(path)` are the entity mutations. Adding a directory already claimed by another Workspace rejects. Adding the primary path or a folder already on this record is a no-op. Removing the primary path rejects. A vanished additional folder can still be removed by its stored spelling. The durable schema defaults missing `folders` to `[]`, so media written before the field still open.

Host RPC exposes `workspace.addFolder` and `workspace.removeFolder`. The Client object layer upserts the returned `WorkspaceView.folders`. The sidebar Workspace menu offers **Add folder…** and reuses the composed directory-flow hole; the hover card lists the primary path and every additional folder.

Collaboration uses the same folder list: `ctx.sandboxPolicy.resolve` copies additional folders onto `SandboxExecutionPolicy.additionalRoots`. `writableRoots` and the Seatbelt, bwrap, Landlock, and Windows-ACL dialects grant those roots under `workspace-write`. `foldersOf(session)` also feeds the `workspace:folders` runtime-context map, default grep/glob roots, extra AGENTS.md chains, and extra project skill roots. Session cwd and attach stay on the primary path so one Session still has one working directory.

## Alternatives considered

- **One Workspace per folder.** Rejected: it splits Sessions, sandboxes, and conversation context, which is the coordination failure this change exists to close.
- **Session cwd becomes a folder set.** Rejected: `SessionHeader.cwd` is the immutable membership and process-cwd key; widening it would rewrite persistence, attach, and every tool that assumes one working directory.
- **A new Workspace-group entity above Workspaces.** Rejected: it adds a second durable identity without changing what the user wants — several folders under one Session.

## Consequences

- A path can belong to only one Workspace, as primary or additional folder. Sharing one tree across two Workspaces remains impossible.
- Adding a folder after a Session is already running updates later sandbox resolves; already-spawned confined processes keep the policy they started with.
- Session cwd remains the primary folder. Additional folders are writable, listed in `workspace:folders` under every sandbox mode, searched by default grep/glob, and each extra folder loads its own AGENTS.md chain and project skills.
- Existing media without `folders` continue to open because the durable schema defaults the field.

## Required verification

- `packages/workspace/workspace/tests/workspace.spec.ts` covers add/remove, primary-path protection, and cross-Workspace claim rejection.
- `packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` covers Host add/remove and `workspace-folder-conflict`.
- `packages/sandbox/sandbox/tests/roots.spec.ts` and `packages/sandbox/sandbox-policy/tests/policy.spec.ts` cover additional writable roots and the `workspace:folders` map.
- `packages/client/runtime/tests/workspaces-service.client.spec.ts` and `packages/client/ui-workspace/tests/rows.client.spec.tsx` cover Client mutation and the add-folder menu/hover list.
