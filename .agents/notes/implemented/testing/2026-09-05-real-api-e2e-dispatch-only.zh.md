# Agent Note: Real-API e2e CI is dispatch-only

Status: implemented

[English](2026-09-05-real-api-e2e-dispatch-only.md) | 中文

## 问题

[.github/workflows/e2e.yml](../../../../.github/workflows/e2e.yml) 消费 `DEEPSEEK_API_KEY_EXTERNAL`，并在该 secret 为空时于 preflight 硬失败，因此没有该 secret 的仓库不能把工作流留在 `push`、`pull_request` 或 `schedule` 上而不把每次可信运行标红。本 fork 没有该 secret。原先的触发集合与 secret 模型见[真实 API e2e Agent Note](2026-06-19-real-api-e2e-ci.zh.md)。

## 决策

该工作流只监听 `workflow_dispatch`，与 E2B 和 pi-ai 实况套件一致。手动触发的运行视为可信，因此 preflight 仍把缺失的 secret 转成明确失败，而不是虚假的绿色。没有 `pull_request`、`push` 或 `schedule` 触发，也没有 job 级的不可信 PR 跳过。

[原笔记](2026-06-19-real-api-e2e-ci.zh.md) 仍拥有独立工作流拆分、secret 映射、步骤级凭证卫生、`DEEPSEEK_BASE_URL` 钉死，以及对 `pull_request_target` 的禁止。

## 曾考虑的替代方案

**保留 push、pull_request 与 schedule，并添加 `DEEPSEEK_API_KEY_EXTERNAL`。** 这会恢复原先的合并与夜间信号，但本仓库没有该密钥，而且每次 master 推送已经在 preflight 失败。

**在 secret 为空时跳过该 job。** 那会在未证明实况套件的情况下保持绿色，而这正是 preflight 要防止的虚假绿色。

**删除工作流文件。** 本地 `pnpm run test:e2e` 以及日后带 secret 的手动触发将没有 CI 入口。

## 后果

master 与 pull request CI 不再运行实况 DeepSeek 套件。持有该 secret 的操作者手动触发工作流。在没有 secret 的情况下重新加上自动触发，会回到本改动去掉的 preflight 红灯。
