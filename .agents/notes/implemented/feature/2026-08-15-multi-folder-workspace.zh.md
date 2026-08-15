# Agent Note: 多文件夹工作区

Status: implemented

[English](2026-08-15-multi-folder-workspace.md) | 中文

## 问题

一个 Workspace 只对应一个规范目录。用户如果把相关树放在兄弟文件夹里——产品仓库加共享库、前端加后端、检出目录加生成资源——就得再开一个 Workspace、再开一个 Session，从而失去共享沙箱、指令集和同一段对话。把每个额外文件夹都做成另一个 Workspace，还会拆开 Session 成员资格，因为 attach 仍然要求 `SessionHeader.cwd` 等于该 Workspace 路径。

## 决策

保留一个主 `path` 作为 Session cwd 和成员资格键。把附加文件夹持久化在同一条 Workspace 记录上，记为有序的 `folders` 规范目录数组。主路径仍是创建时的 realpath，之后永不改写；附加文件夹永不包含该路径；唯一性是所有 Workspace 主路径与附加文件夹之间的规范路径字符串相等。

`Workspace.addFolder(path)` / `removeFolder(path)` 是实体变更。添加已被其他 Workspace 声明的目录会拒绝。添加主路径或本记录已有的文件夹是空操作。移除主路径会拒绝。已消失的附加文件夹仍可按存储拼写移除。持久 schema 把缺失的 `folders` 默认成 `[]`，因此该字段出现之前写入的介质仍能打开。

Host RPC 暴露 `workspace.addFolder` 与 `workspace.removeFolder`。Client 对象层会用返回的 `WorkspaceView.folders` 做 upsert。侧边栏 Workspace 菜单提供 **添加文件夹…**，并复用已组合的目录流子 slot；悬停卡片列出主路径和全部附加文件夹。

协同使用同一份文件夹列表：`ctx.sandboxPolicy.resolve` 把附加文件夹复制到 `SandboxExecutionPolicy.additionalRoots`。`writableRoots` 以及 Seatbelt、bwrap、Landlock、Windows ACL 方言在 `workspace-write` 下授予这些根。Session cwd、attach 和指令发现仍走主路径，因此一个 Session 仍然只有一个工作目录。

## 考虑过的替代方案

- **每个文件夹一个 Workspace。** 否决：它会拆开 Session、沙箱和对话上下文，而这正是本次变更要关掉的协同失败。
- **把 Session cwd 变成文件夹集合。** 否决：`SessionHeader.cwd` 是不可变的成员资格和进程 cwd 键；放宽它会改写持久化、attach，以及所有假定只有一个工作目录的工具。
- **在 Workspace 之上再做一个分组实体。** 否决：它增加第二个持久身份，却不改变用户想要的东西——多个文件夹落在同一个 Session 下。

## 后果

- 一条路径只能属于一个 Workspace，无论作为主路径还是附加文件夹。两套 Workspace 共享同一棵树仍然不可能。
- 在 Session 已经运行后再加文件夹，只影响之后的沙箱解析；已经拉起的受限进程继续使用启动时的策略。
- 指令发现和 Session cwd 仍是主文件夹。附加文件夹可写，并出现在当前策略提示里，但本次变更不会把它们变成额外的指令根。
- 没有 `folders` 的既有介质仍能打开，因为持久 schema 会默认该字段。

## 必要验证

- `packages/workspace/workspace/tests/workspace.spec.ts` 覆盖添加／移除、主路径保护和跨 Workspace 声明拒绝。
- `packages/host/apiproxy/tests/api-proxy-workspace.spec.ts` 覆盖 Host 添加／移除和 `workspace-folder-conflict`。
- `packages/sandbox/sandbox/tests/roots.spec.ts` 与 `packages/sandbox/sandbox-policy/tests/policy.spec.ts` 覆盖附加可写根。
- `packages/client/runtime/tests/workspaces-service.client.spec.ts` 与 `packages/client/ui-workspace/tests/rows.client.spec.tsx` 覆盖 Client 变更以及添加文件夹菜单／悬停列表。
