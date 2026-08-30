# Agent Note: 开 PR 实操手册

Status: implemented

[English](2026-08-30-opening-a-pull-request-cookbook.md) | 中文

## 问题

PR（Pull Request）策略由 Issue policy、标签分类、测试、文档配对、堆叠落地和 GUI 证据分别强制执行，这些所有者分散在不同的 Note、skill（技能）和工作流文件中。要开一个 PR 的贡献者没有一份手续，能在不复述每个所有者的情况下点名必需的 Issue 引用、标签、同次变更证据、本地检查和历史规则。

根 README 是产品入口，并且已经链接贡献与开发。若没有那条链接，新实操手册只能靠 cookbook 文件名被发现。

## 决策

[`docs/cookbook/opening-a-pull-request.md`](../../../../docs/cookbook/opening-a-pull-request.zh.md) 是维护者与 agent（智能体）打开、打标签、举证并落地 PR 的清单。它不接受外部贡献；那扇仍然关闭的门留在 [`CONTRIBUTING.md`](../../../../CONTRIBUTING.zh.md)。

该实操手册引用现行所有者，而不复制其清单：Issue 引用与正文形态引用 Issue policy 和 PR 模板，`kind/*` 与 `area/*` 引用[标签分类](2026-08-08-unified-github-label-taxonomy.zh.md)，同次变更证据引用 Agent Note / 测试 / GUI GIF / 配对，本地检查引用 [dsh-pre-push-checks](../../../skills/dsh-pre-push-checks/SKILL.md)，历史与评审修复归属引用[原生堆叠](2026-08-02-native-github-stacks-and-optional-rebases.zh.md)以及[堆叠评审实操手册](../../../../docs/cookbook/responding-to-pr-review-on-a-stack.zh.md)。

根 README 的「参与贡献」一节和开发指南链接该实操手册。文档网站的 Cookbook 分组发布该配对。PR 模板和堆叠评审实操手册也指向它，使入口能从人们已经打开的界面到达。

## 考虑过的替代方案

**把完整清单放进 `CONTRIBUTING.md`。** 该文件是面向社区的闭门说明。把它扩成维护者手续会混用读者，并淹没当前「不接受外部 PR」的事实。

**只把清单放进根 `AGENTS.md`。** Agent 现行指令保持一到三行再加链接。带 Issue 引用、标签、证据和落地步骤的手续属于 cookbook。

**只靠 cookbook 文件名被发现。** 从 README 或 GitHub PR 表单起步的贡献者找不到该清单。README、开发指南、模板和堆叠评审实操手册是现有入口。

## 后果

维护者与 agent 对进入评审的非 Draft 人类 PR 有一份手续。策略变更仍落在所属工作流、分类 Note 或 skill 中；这些必需步骤变化时，实操手册在同一次变更中更新。社区读者仍然先碰到 `CONTRIBUTING.md`，不会被邀请打开本仓库不会接受的 PR。
