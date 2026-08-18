# Agent Note: Discover provider reasoning efforts

Status: implemented

[English](2026-08-18-discover-provider-reasoning-efforts.md) | 中文

## Problem

手工声明的 pi-ai 模型在写上 `reasoningEfforts` 之前没有可选思考档位。模型页已经能从 `GET /models` 获取 id 与容量，但那次回复会丢掉网关实际公布的档位元数据。因此通过 FAC 添加 Grok 4.6 的用户会看到没有思考强度面板的模型选择器，唯一补救是手工编辑 `$DSH_HOME/settings.yaml`。

## Decision

询问仍保持 [[2026-08-04-draft-provider-endpoint-interrogation]] 的一次性、什么都不存储姿态。`LlmDiscoveredModel` 与 `llm.discoverModels` 协议视图新增两个可选字段：`reasoningEfforts`（选择器 id → 协议拼写；`off` 可以为 `null`）以及 `supportsReasoningEffort`。服务会丢弃未知档位 id、空键和空的协议拼写，而不是发明一份声明。

`dsh-llm-pi-ai` 从两处填写这些字段。catalog 路由仍由已安装注册表作答，现在还包括每个模型支持的思考档位，以及 catalog 上的 `compat.supportsReasoningEffort`（如有）。网关列表会读取 `reasoningEfforts`/`reasoning_efforts` 与 `supportsReasoningEffort`/`supports_reasoning_effort`。字符串 token，或对象的 `value`/`id`/`name`/`label`，只有在点名已知 pi-ai 档位时才会保留；未知协议拼写只要旁边有已知档位标签，仍可落盘。

采纳一条新获取的行时，会把公布的字典写成该模型的 `reasoningEfforts`，并在列表有说明时写入 `compat.supportsReasoningEffort`。重新勾选一条已有行时，只有该行仍未声明思考档位才会补上这些字段；之后再获取不会覆盖手工调过的声明。composer 的思考强度面板没有改动：它本来就会提供 `resolveModelInfo` 报告的档位。

## Alternatives considered

**按模型 id 猜测 Grok 4.6 的档位。** 不必改协议就能解开这一张 FAC 卡片。否决：其他网关对可接受档位并不一致，而在关不掉思考的模型上猜一个 `off`，正是 [[2026-08-03-pi-ai-declared-provider-catalog]] 已经拒绝过的谎言。

**在模型页暴露 `reasoningEfforts` 编辑器。** 与支持图片复选框对称。本次否决：提供方已经公布了可选集合，缺的是读它。手工编辑器仍留在 YAML，与 [[2026-08-08-pi-ai-per-model-reasoning-declarations]] 的决定一致。

**发一次真实补全，看端点接受哪些 `reasoning_effort`。** 对什么都不公布的列表有用。否决：这是对调用方自选 URL 的多次变更性请求，而且一次被拒并不能可靠映射出支持集合。

## Consequences

获取 FAC 或其他会公布思考档位的 OpenAI 兼容网关后，保存即可让 composer 出现思考强度面板，不必再改 YAML。仍然只公布 id 的列表保持沉默，那些模型继续不提供思考强度控件。未知 token 永远不会变成适配器随后会拒绝的 profile 键。

## Testing

`packages/llm/llm/tests/topology.spec.ts` 会保留已公布的字典，并丢弃空键与空的协议拼写。`packages/llm/llm-pi-ai/tests/discovery.spec.ts` 会读取 camelCase 与 snake_case 列表字段、丢弃未知 token、把已知标签旁的未知协议值映射进去，并在不联网的情况下报告 catalog 路由的档位。`packages/host/apiproxy/tests/api-proxy-config.spec.ts` 会把新字段送过 RPC。`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` 会写入已采纳的档位和 `compat.supportsReasoningEffort`，同时不改动已经调过的行。
