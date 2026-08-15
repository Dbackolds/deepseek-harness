# Agent Note: 用户系统提示词库与按模型组装

Status: implemented

[English](2026-08-15-user-system-prompts.md) | 中文

## 问题

系统提示词注册表由插件编写。用户若想要可复用的提示词文本，再按模型选择不同的有序列表——包括替换已组装提示词——既没有设置页，也没有该库的 Host 拥有方。在组合配置里改 `persona`，或改 preset 的 `dsh-persona` 行，都无法表达多选、排序，以及能越过 `complete` persona 还原的按模型覆盖。

## 决策

`dsh-user-system-prompts` 拥有 `user-system-prompts` Settings 分节：`{ id, name, text }` 提示词库，以及 `{ provider, model, promptIds, override }` 的按模型绑定。`dsh-client-ui-settings-system-prompts` 在 Agent 预设之后注册「系统提示词」设置页。写入走 `settings.replace`。组装通过 `ctx.systemPrompt.afterAssemble()` 应用匹配模型的选中文本；该 hook 在协作式 waterfall 之后、以及有效 complete 段还原之后运行。

`afterAssemble` 放在 `dsh-system-prompt` 上，因为 `system-prompt/assemble` 监听器无法替换 `complete` 段：注册表在 waterfall 之后还原该段。若用户覆盖就是模型应收到的提示词，就必须在这次还原之后运行。

绑定按随附循环已经注册的已组装 `{{provider}}`／`{{model}}` 变量索引。缺少这些变量、或没有绑定的组装保持不变。未知 id 与重复键在 Settings 写入时失败。

## 备选方案

- **注册普通 `systemPrompt.section()` 行，并在设置变更时改它们**——无法替换 `complete` preset persona；文本会在会话中途变化的存活段，仍然需要同样的还原后 hook 才能覆盖。
- **把库放进 `dsh-system-prompt` Config**——该插件拥有部署 persona 和工具顺序，而不是终端用户目录。第二个由 Settings 支撑的拥有方保持注册表约定不变。
- **每个模型一个自由文本字段**——失去跨模型复用，也无法表示顺序和多选。
- **按选中的单条提示词覆盖，而不是按模型**——一旦存在 `complete` 段，混合追加／替换列表没有定义好的组合方式；每个模型一个开关就是完整策略。

## 后果

- 设置导航增加「系统提示词」一行。该页是库与绑定的唯一产品编辑器。
- `override: true` 的模型只收到选中的库文本，即使 preset 挂载了 complete persona。
- 更改库或绑定会在任何已组装提供方／模型对匹配的会话的下一次组装步骤生效。
- ApiProxy 必须暴露 `user-system-prompts`，否则该页无法持久化。

## 测试

Host 测试覆盖追加、complete 段之后的覆盖、空库空操作，以及写入时校验。客户端测试覆盖注册、创建／替换写入、删除从绑定中级联移除，以及分区的添加／重排／覆盖手势。ApiProxy 服务该命名空间。Web 快照包含新的导航行。
