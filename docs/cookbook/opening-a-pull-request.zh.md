# 实操手册：开一个 PR

[English](opening-a-pull-request.md) | 中文

如何打开、打标签、举证并落地 DeepSeek Harness 的 PR（Pull Request）。社区贡献者目前不能向本仓库落地（[CONTRIBUTING.md](../../CONTRIBUTING.zh.md)）；维护者与 agent（智能体）仍按本清单执行。堆叠评审修复的归属见[堆叠评审实操手册](responding-to-pr-review-on-a-stack.zh.md)；落地一条依赖链见 [dsh-merging-stacked-prs](../../.agents/skills/dsh-merging-stacked-prs/SKILL.md)。

## 打开之前

1. 确认工作属于本仓库。外部 PR 不被接受；生态工作放在带 `dsh-plugin` 话题的社区插件中。
2. 拆开相互独立的变更。一个 PR 只有一个主导意图。有依赖的后续工作在落地前使用 GitHub 官方的 stack 对象（[原生堆叠](../../.agents/notes/implemented/process/2026-08-02-native-github-stacks-and-optional-rebases.zh.md)）。
3. 让分支基于当前 `master`（或官方堆叠中的父 PR）。相对过期 base 的可合并状态不是当前证据。
4. 先打开或复用一个同仓库 Issue。进入评审的非 Draft 人类 PR 必须引用至少一个这样的 Issue。

## 正文与 Issue 引用

使用 [.github/pull_request_template.md](../../.github/pull_request_template.md)。保持外露正文简短：Issue 引用放在 `<details>` 之外；变更与验证说明保持收起。

- 合并该 PR 应关闭该 Issue 时写 `Fixes #NN`（或 `Closes` / `Resolves`）。只关联不关闭时写 `Related to #NN`。
- 计入的是同仓库 Issue。解析为另一个 PR 的编号不满足该策略。
- 解析引用时忽略 HTML 注释、围栏代码和行内代码。
- 当 PR 不是 Draft、作者不是 Bot 或 App，并且已有评审请求或已提交的评审时，[Issue policy](../../.github/workflows/issue-policy.yml) 要求至少一个同仓库 Issue 引用以及下面的标签。

## 标签

每项开放或已合并的 PR 都带有恰好一个规范的 `kind/*`，以及至少一个表示实质受影响领域的 `area/*`（[分类体系](../../.agents/notes/implemented/process/2026-08-08-unified-github-label-taxonomy.zh.md)）。当前清单以 GitHub 上现存的 `area/*` 名称为准。

| 类型 | 主导意图 |
|---|---|
| `kind/feature` | 新增或有意改变行为。 |
| `kind/bug-fix` | 纠正不正确的行为。 |
| `kind/doc` | 以文档为主要意图。 |
| `kind/testing` | 只改测试或测试基础设施，不改变产品行为。 |
| `kind/cleanup` | 在保持行为的同时维护或简化实现或仓库流程。 |
| `kind/dependency` | 更新依赖，且没有其他主导意图。 |

不要把 `source/*` 打在 PR 上（仅用于 Issue）。不要重建诸如 `kind/bug` 或 `kind/documentation` 的保留别名。随附的测试、文档或清理不能覆盖 feature 或 bug-fix 类型。带 `p0`–`p3` 的解决型 `Fixes` PR 必须匹配它所关闭 Issue 中的最高 Priority；这些 Issue 都没有 Priority 时不要打 Priority 标签。

Issue 使用原生 Issue Type，而不是 `kind/*`。其标题包含中文，并且不以 Type、Priority、Status、area 或 Owner 为前缀。

## 必须落在同一次变更里的内容

- **Agent Note。** 非琐碎工作在同一个 PR 中新增或更新一篇（[何时写一篇](../../.agents/notes/README.zh.md#when-to-write-one)）。纯机械或局部编辑是唯一豁免。
- **文档与 JSDoc。** 公开行为、配置、默认值、错误、线协议字段和事件同时更新所属 README 与 JSDoc（[文档标准](../AGENTS.md)）。
- **与变更表面匹配的测试。** 包行为、产品可见插件的真实 Loader 或进程组合，以及模型可见或产品用户可见输出变化时的无密钥已录制会话快照（[测试策略](../testing.zh.md)）。
- **GUI 证据。** 文案由 locale 持有、`verify-client-ui-i18n`，以及所属的 `test:web` 或设置 golden。产品用户可见的 GUI 变更还要包含从该 PR 的树录制的演示 GIF（[record-browser-gif](../../.agents/skills/record-browser-gif/SKILL.md)）。
- **双语配对。** 被编辑的配对文档在同一个 PR 中更新对侧，然后重新记录 `pnpm run verify-translation-pairing --write <pair>`。

## 进入评审前的本地检查

Git 钩子保持窄范围：暂存的 lint、空白、vendor-manifest、配对记录，以及 push 时的 `pnpm run typecheck`。贡献者对[覆盖外发 diff 的最小检查集](../../AGENTS.md#run-relevant-checks-locally)运行一次；由 [dsh-pre-push-checks](../../.agents/skills/dsh-pre-push-checks/SKILL.md) 选择。CI 负责全量覆盖率和平台矩阵。当变更需要快照、`doc-sync`、构建产物冒烟或 `test:web` 时，不要仅凭绿色的单元测试套件声称检查已通过。

`gh stack sync` 之后立即验证，在该证据通过之前不要合并。

## 历史与落地

独立分支和堆叠分支都可以 merge-forward 或 rebase。远端改写使用 `--force-with-lease` 或受 lease 保护的 `gh stack` 推送路径；如果远端已移动则中止。禁止直接使用 `--force`。在采用更新的 base 之前，保留正在进行的 merge-forward 检查点。

同一仓库中两条或更多相互依赖的 PR 在落地前使用 GitHub 官方堆叠。通过该堆叠流程落地，而不是逐个 PR 合并再手动改 target。

## 评审

优先正确性、生命周期、安全和被破坏的必需行为。带一条有依据阻断项的短评审就够。仓库特定检查使用 [dsh-code-review](../../.agents/skills/dsh-code-review/SKILL.md)。在现有评审线程中回复；改写推送后重新读取未解决线程、批准状态、可合并性和检查结果，因为旧的 commit OID 和内联锚点不是当前证据。

## 验证

- 正文按意图用 `Fixes` 或 `Related to` 引用了同仓库 Issue，且线上标签恰好是一个允许的 `kind/*` 加上实质受影响的 `area/*` 名称。
- diff 包含该变更表面所需的 Agent Note、文档、测试、快照和 GUI 证据，或与这些策略相符的明确豁免。
- 已针对当前 base 运行相关本地检查；CI 为绿，或失败 job 已被诊断而不是被忽略。
- 堆叠变更是官方 GitHub 堆叠，并且每个子 PR 相对其父 PR 的 diff 只显示该子 PR 自身的工作。
