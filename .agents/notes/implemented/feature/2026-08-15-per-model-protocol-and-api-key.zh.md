# Agent Note: Per-model protocol and API key

Status: implemented

[English](2026-08-15-per-model-protocol-and-api-key.md) | 中文

## Problem

Models 页按提供方只存一种协议格式和一条 API 密钥。同时讲 Chat Completions、Responses 与 Anthropic Messages 的网关，或按模型分别计费的密钥，只能拆成多个提供方 id。用户要求每个模型可选 `openai` / `responses` / `messages`，并且支持一条密钥挂多个模型，或一条密钥对应一个模型。

## Decision

`PiAiModelProfile` 接受 `api` 与 `apiKeyEnv`。协议按 模型 → 路由 → catalog 解析，凭据按 模型 → 路由 解析。当一条路由上的模型协议不一致时，`createProvider` 收到一份 `api` 映射，因此一个 pi-ai `Provider` 可以承载混合协议。请求先解析所选模型的引用；缺失仍抛 `MISSING_CREDENTIAL`，绝不回落到环境里的无关密钥。

Models 页把 `supportedProtocols()` 的三个值作为提供方默认，并在每个模型行再给一次（行未点名时为「使用提供方默认」）。键入的模型密钥若与提供方字段或其他模型刚键入的值相同，会复用该引用；不同的值存到 `<ROUTE>_<MODEL>_API_KEY`。删除一行时，会取消设置该 profile 点名的、由本页派生的全部引用。

## Alternatives considered

**把混合协议拆成两个提供方 id。** 否决，因为选择器与会话日志已经把路由当作提供方身份。用户得记住哪个 id 拥有哪个模型。

**把明文密钥写在模型行上。** 否决，因为 `settings.yaml` 不得携带机密。既有凭据引用平面已经以只写方式存值。

**一个密钥字段再列出它适用的模型。** 否决，因为页面已经按行编辑模型。把密钥绑在行上，同时覆盖「一模型一密钥」和「一密钥多模型」，无需第二套分组控件。

## Consequences

catalog 路由可以保留每个已随附模型的协议，同时再加一个讲另一种协议的模型。一条已存密钥可以服务多个模型；缺失的按模型引用只让选中该模型的请求失败。本页管理的删除集合从约定的一条 `<ROUTE>_API_KEY`，扩大到本页派生的每一条 `<ROUTE>_<MODEL>_API_KEY`。

## Testing

`llm-pi-ai` catalog 测试钉死同一路由上的混合 `api` / `apiKeyEnv`，并拒绝空的按模型引用。一条 adapter 测试在连续请求上分别送出路由密钥与模型密钥。settings-models store 测试钉死共享引用分配；自定义提供方表单测试在一次创建中写入两种协议和两条密钥。
