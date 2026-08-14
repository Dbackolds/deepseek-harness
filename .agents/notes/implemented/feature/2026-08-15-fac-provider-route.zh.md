# Agent Note: 随发行版交付的 FAC 提供方路由

Status: implemented

[English](2026-08-15-fac-provider-route.md) | 中文

## 问题

模型页可以添加任意已安装 pi-ai catalog 提供方，或完整声明一个自定义网关。FastAI Code（`fac`）是已知公共 URL 上的 OpenAI 兼容端点，但 pi-ai 并未内置它。用户每次都要创建自定义提供方并手填该 URL。

## 决策

`dsh-base` 挂载一份组合层 `fac` profile，因此模型页把 FAC 作为与 DeepSeek 同级的卡片并排在其上面。路由键为 `fac`，显示名为 `FAC`，默认端点为 `https://new.fastaicode.top/v1`，协议格式（wire format）为 `openai-completions`。`dsh-llm-pi-ai` 还会把 FAC 声明在可配置提供方目录的最前面。一份不写 `api`、`baseURL` 或 `models` 的 settings profile 即可服务：适配器注册该路由，discovery 询问该默认 URL，未列出的模型 id 仍在请求时以 `UNKNOWN_MODEL` 失败，直到用户获取或录入模型。`declared` 为 false，因此模型页把 FAC 当作随发行版交付的提供方，而不是自定义提供方。未设置的 FAC `baseURL` 编辑器占位符就是该默认 URL。

## 曾考虑的替代方案

**只把 FAC 留在休眠的「添加提供方」列表里。** 不予采纳，因为需求是一张与 DeepSeek 同级的常驻卡片，而不是用户还要再添加一次的目录选项。

**给 FAC 单独做一个与 `llm-deepseek` 并列的适配器包。** 不予采纳，因为该端点是 OpenAI 兼容的；一旦路由、协议和 URL 已知，pi-ai 适配器已经能服务它。

**只把 FAC 写成自定义提供方配方。** 不予采纳，因为该 URL 是产品默认值，不是每次部署自己发明的地址；自定义卡片在保存前仍会索要协议和至少一个模型。

## 后果

模型页始终把 FAC 排在 DeepSeek 上面。保存一份只含密钥的 FAC profile 会记下 `providers.fac`（存了密钥时还有 `apiKeyEnv`），模型列表保持为空，直到用户获取或录入。之后自定义的 `baseURL` 仍会覆盖默认值。空的 FAC 模型列表在用户获取或录入之前不会出现在 composer 里。

## 测试

`packages/llm/llm-pi-ai/tests/catalog.spec.ts` 固定 FAC 在目录中排第一，以及仅密钥 profile 的默认端点。`discovery.spec.ts` stub `fetch` 并断言 listing URL。`packages/client/ui-settings-models/tests/components.client.spec.tsx` 固定 FAC 占位符和组合层自有设置卡片姿态。`apps/web/tests/models-settings.e2e.ts` 与模型页 snapshot 显示 FAC 卡片在 DeepSeek 上面。
