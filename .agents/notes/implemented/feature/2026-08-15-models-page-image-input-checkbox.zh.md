# Agent Note: Models 页的图片输入复选框

Status: implemented

[English](2026-08-15-models-page-image-input-checkbox.md) | 中文

## Problem

手动输入的模型在自己声明之前一律按纯文本对待，因为没有任何环节能去询问端点接受哪些模态。给这类模型附加图片，会在发送前就被拒绝，并点名该模型。Models 页已经能编辑 pi-ai profile 的 `models` 数组，但没有 `input` 的控件。因此声明一个视觉模型意味着打开 `$DSH_HOME/settings.yaml` 并知道这个字段存在。通过表单配置了视觉模型的用户——FAC、自定义网关、拉取到的 catalog id——只会碰到 toast，页面上没有纠正它的办法。

## Decision

每条 pi-ai 模型行在标识行上、紧挨 id 与显示名称处，带一个**支持图片**复选框。勾选即为该模型写入 `input: [text, image]`。取消勾选会丢掉该字段，而不是存入 `[text]`：缺省会保留已安装 catalog 条目，再回退到路由的 `defaultInput`，因此 catalog 视觉模型会保持视觉能力，直到该行自己另行声明。复选框是对端点的断言，而不是对它的检查；声明了端点并不提供的图片能力的模型，仍会由提供方拒绝。

该控件不出现在 DeepSeek 的 catalog 编辑器上。DeepSeek 自身的 chat-completions 路由是纯文本的，且无法通过配置改变。

该字段留在行上，而不是收进「容量」折叠区。手工声明的视觉模型在设置该字段之前无法使用；把它藏在容量后面，会让 toast 成为发现该字段的唯一途径。

`$DSH_HOME/settings.yaml` 仍接受同样的 `input` 与 `defaultInput` 列表。表单只写按模型的断言；路由级回退，以及通过 `modelOverrides` 收窄 catalog 模型，仍走 YAML。

## Alternatives considered

**把复选框放进「容量」折叠区。** 行上就只剩一行标识。否决：手工声明的视觉模型在设置该字段之前无法使用，而折叠区标的是「容量」，追着 toast 来的用户不会去打开它。

**加一个路由级「每个模型都接受图片」复选框，写入 `defaultInput`。** 纯视觉网关只需点一次。否决：`defaultInput` 是回退值而不是覆盖值，catalog 路由设置它既不会剥掉本就有图片能力的 catalog 模型，也不会给已经声明纯文本的 catalog 模型补上图片。手工声明的行真正需要的，是按模型的断言。

**取消勾选时写入 `[text]`。** 与勾选值对称。否决：那会把网关本就服务图片的 catalog 模型的图片能力剥掉，与「缺省该字段」相反。

**DeepSeek 行也提供该复选框。** 同一套编辑器约定。否决：DeepSeek 的 chat-completions 适配器拒绝图片内容，且无法通过配置改变，勾选只会写入一条适配器随后拒绝的断言。

## Consequences

FAC 或自定义提供方上的视觉模型无需离开浏览器即可声明。代价是每条 pi-ai 行多一个控件；勾选了但端点实际并不接受的模型，仍会在提供方处以中途失败收场。

## Testing

`packages/client/ui-settings-models/tests/provider-form.client.spec.tsx` 由复选框写入 `input: [text, image]`，取消勾选则丢掉该字段。获取选择框的用例在 dialog 内查询复选框，以免与行上的控件撞车。`apps/web/tests/models-settings.e2e.ts` 在声明路由时勾选该框并断言已存的 `input` 列表；declared-edit snapshot 包含已勾选的控件。
