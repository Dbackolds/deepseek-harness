# Agent Note: 按模型替换系统提示词

Status: implemented

[English](2026-08-15-per-model-system-prompt.md) | 中文

## Problem

部署级 persona 是进程级一份模板。当同一份 catalog 里混着指令需求不同的模型——例如一个要极简的 coder 和一个要详细的 reviewer，或网关模型已经自带身份——就无法在不新建 agent preset、也不手改组合层的情况下，给每个模型各自一份完整系统提示词。

## Decision

每个适配器 catalog 条目都可以带可选字符串 `systemPrompt`。缺省或仅空白时，继续走普通系统提示词组装。非空值是该确切模型 id 的完整系统提示词模板：`agent-loop` 在现有的严格 `{{variable}}` 插值之后，用这段文本替换所有已组装的系统提示词段落。

该字段经 `LlmResolvedModelInfo.systemPrompt` 传递。`LlmRuntime.resolveModelInfo` 转发字符串并丢弃空串；非字符串值以 `INVALID_MODEL_SYSTEM_PROMPT` 失败。DeepSeek 把字段存在 catalog 条目上，且只对已列出的 id 公开。pi-ai 不能把它挂到上游 `Model` 上，因此解析时在 `configuredMaxTokens` 旁另备一份 `configuredSystemPrompts`；`models` 与 `modelOverrides` 都写入该 map。

替换发生在 `system-prompt/assemble` 的 `next()` 之后。工具 schema、runtime-context 快照和提示词变量保持不动。作用域内的 `complete` persona 在 waterfall 之后恢复，因此 agent 作用域的完整身份仍比 catalog 提示词更优先。

Models 设置编辑器在每行展开区提供全宽 textarea。清空该框会取消设置该字段，而不是写入空字符串。

## Alternatives considered

**在部署 persona 旁追加一段模型专属段落。** 那样会留下 harness 身份和工具指导。产品要求是可替换的系统提示词，而不是多一段话。

**只替换 `deployment:persona`。** 那样会留下 harness 身份和工具段落。已经自带身份的模型仍会收到这些开场白。

**把字段放在按 provider/model 索引的 `system-prompt` 配置上。** 那样会把模型身份拆到两个 settings namespace。catalog 条目已经点名了这次请求会用的模型。

**让适配器在 stream 时注入提示词。** 那样会让替换躲开 `request/header` 重建和提示词检查工具。系统文本仍只由组装拥有。

## Consequences

已列出的模型可以在不新建 preset 的情况下拥有整段系统提示词。未列入 DeepSeek catalog 的原样传递 id 继续走普通组装，直到被加入目录。只在 `agent/request` 里晚绑定的路由仍跟随 `AgentOptions`，与现有 `{{model}}` 变量一致。更改某模型的 `systemPrompt` 会从下一次使用该模型的请求的第一个系统 token 起使前缀缓存失效。

## Testing

包测试钉住 schema 解析、空串丢弃、`resolveModelInfo` 转发、agent-loop 替换、complete persona 优先，以及两端 Models 编辑器写入与取消设置该字段。无密钥的 headless DeepSeek-defaults snapshot 通过一次性应用发送 catalog `systemPrompt`，并断言协议上的 `system` 消息。
