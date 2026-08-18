# @deepseek-ai/dsh-client-ui-git-branch

English | [中文](README.zh.md)

Hero Git branch chip on the new-session screen. It fills `conversation.hero.branch` beside the workspace picker and the agent-preset chip, lists the workspace repository, and switches this session overlay through `git.describe` / `git.checkout` / `git.createBranch`.

The workspace checkout stays the Session membership key. Checking out any other branch creates or reuses a linked worktree under `$DSH_HOME/worktrees/<workspace-id>/<session-id>` and records one `git/worktree` event. Two sessions can therefore sit on different branches without moving each other. A workspace that is not a Git checkout hides the chip.

The chip reloads when the current session changes, so each conversation keeps the branch it last selected. Creating a branch opens a small modal, then checks the new name out for this session only. Remote-tracking rows keep the remote prefix. A detached workspace checkout labels the chip and current row Detached HEAD. The current-branch row lists this session worktree's uncommitted path count and, when an upstream exists, the unpushed commit count.

## Model Experience

None, as the picker is browser chrome; the host worktree overlay owns every model-facing cwd effect.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No dirty-tree merge** — switching away from a dirty isolated worktree force-removes that tree; uncommitted work must be committed or stashed first.
- **No remote push or pull** — the chip only lists and checks out local or already-fetched remote-tracking names.
