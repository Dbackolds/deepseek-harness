# Agent Note: Defer user-patch HMR until live agents are idle

Status: implemented

[English](2026-08-27-defer-user-patch-hmr-during-turns.md) | 中文

## 问题

在一轮进行中写入 `$DSH_HOME/profiles/<name>/cordis.patch.yml` 会立刻触发 `watchUserPatches`。重新组合根 Include 会 dispose（资源释放）持有正在运行 Agent（智能体）的插件树，并把该轮取消为 `{ kind: 'aborted', reason: { kind: 'disposed' } }`。code-runtime 的 abort 路径随后执行 `String(signal.reason)`，因此面向模型的 `run_code` 结果是 `Error: code run failed (abort): [object Object]`，嵌套工具（例如 `write`）则结算为 `Error: tool call aborted`。因为 dispose 中止是已完成的轮次，而不是崩溃恢复的 `interrupted`，Host 不会自动续跑；智能体停在那里，直到用户稍后发送提示词。同一会话只能靠用户发送「继续」才能接着跑。

## 决策

`watchUserPatches` 在重新组合之前会等待 `ctx.agents` 中每个活动条目进入空闲。HMR（热模块替换）仍会串行处理各代文件，因此一轮进行中的写入会在该轮结算后应用最新文件内容，而不是中止该轮。没有 agents 注册表的组装保持原先的立即刷新。中止信号诊断使用 `dsh-session` 的 `formatAbortReason`：类型化的 `AgentCancelCause` 渲染为 `cancelled by user`、`cancelled by parent`、`agent disposed`、`cancelled by hook: <reason>` 或 `cancelled by automation <ruleId>`。`dsh-code-runtime-worker-thread` 与 Code Mode 的 run-over 消息调用该 helper，而不再 `String(reason)`。

## 备选方案

**把 dispose 中止当成崩溃恢复的 `interrupted` 并自动 followup。** 否决：dispose 是带类型化原因的已完成轮次，不是需要合成收尾事件的未闭合日志。把它并进重启续跑，会在有意卸载后唤醒智能体。

**让 `write` 拒绝正在使用的 profile patch 文件。** 否决：该文件是合法的配置目标；缺陷是应用它会杀掉写入者，而不是写入本身被禁止。

**继续 `String(reason)`，只推迟 HMR。** 否决：其余类型化原因的中止（用户停止、父级取消、hook）仍会把 `[object Object]` 呈现给模型。

## 影响

同一轮写入 `cordis.patch.yml` 不再中止该轮。新组合仍在空闲后落地，因此会改工具或模型的 patch 在下一轮生效，而不是在工具执行中途生效。`dsh-app-boot` 通过 `dsh-agent` 可选地为 `ctx.agents` 提供类型；没有该服务的组装会跳过等待。面向模型的 abort 文本现在是稳定的英文短语，而不再是 `[object Object]`。
