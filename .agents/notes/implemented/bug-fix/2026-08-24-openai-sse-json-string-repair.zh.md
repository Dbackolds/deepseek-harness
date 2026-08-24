# Agent Note: 修复 OpenAI 兼容 SSE 中的非法 JSON 字符串字面量

Status: implemented

[English](2026-08-24-openai-sse-json-string-repair.md) | 中文

## 问题

PTC 模式下的 Grok 轮次会在任何工具运行之前失败，错误为 `Bad control character in string literal in JSON` 或 `Unterminated string in JSON`，界面显示 `PI_AI_ERROR`（Web UI 为 `PT_AI_ERROR`）。模型发出的 `run_code` 工具调用 `arguments` 在 JSON 字符串内含有真实换行、制表符或未闭合引号。OpenAI SDK 对每条 SSE `data:` 载荷做 `JSON.parse` 并抛出；pi-ai 把该 `SyntaxError.message` 扁平化到终止错误事件；`classifyPiAiError` 匹配不到，于是落入兜底，`llm-retry` 也不重试。

pi-ai 已会在 SDK *解析完 SSE 事件之后*，对*工具调用参数对象*修复部分非法字符串字节。当*事件本身*还不是 JSON 时，那段 walker 根本不会运行。pi-ai 构造 OpenAI client 时没有 `fetch` 钩子，因此适配器无法把自定义解析器传进 SDK。

## 决策

- `dsh-llm-pi-ai` 在 SDK 读取之前，于 fetch 响应体上修复 OpenAI 兼容 SSE JSON。
- `repairJsonStringLiterals` 转义 JSON 字符串内的原始 C0 控制字符与非法反斜杠序列，并闭合仍在 EOF 打开的字符串。随后 `closeUnterminatedJsonContainers` 补上未匹配的 `{` / `[`，使被截断的事件成为可解析分片。已经合法的 JSON 原样返回。
- `createSseJsonRepairStream` 缓冲到不在 JSON 字符串内的空行事件终止符，把被真实换行拆开的 `data:` 载荷重新拼回，并再发出一行 `data:`。
- 因为 pi-ai 的 OpenAI client 没有 `fetch` 选项，每次适配器流对 `globalThis.fetch` 取一个引用计数租约。重叠的流共享同一个包装；最后一个 disposer 恢复原先的 `fetch`。非 SSE 响应原样通过。
- 经过这一步仍不是 JSON 的载荷以 `PI_AI_ERROR` 使本轮失败。闭合被截断字符串得到的不完整工具调用参数，由工具执行器校验，而不会被补造成一次成功调用。

## 考虑过的替代方案

**给 `@earendil-works/pi-ai` 或 OpenAI SDK 打补丁，让 SSE data 走 `parseJsonWithRepair`。** 否决：harness 并不拥有这些包，为一种提供方缺陷维护 `pnpm.patchedDependencies` 条目会在每次升级时重做。

**把这些 `SyntaxError` 文案分类为可重试的 `TRANSPORT` 或 `INVALID_REQUEST`。** 否决：字节已经到达；重发同一请求会再现同一份非法 JSON。`PI_AI_ERROR` 仍是不可重试的兜底；修复之道是解析该事件。

**让模型重试，或要求操作者离开 PTC 模式。** 作为产品修复否决：Grok 4.6 在 code mode 下经常把真实换行写进 `run_code` 参数。协议层必须接受这种输出。

**通过 pi-ai `StreamOptions` 注入自定义 OpenAI client。** 否决：pi-ai 0.82.1 在 OpenAI Completions 路径上仍不暴露 `fetch` / client 钩子。在流生命周期内包装 `globalThis.fetch` 是现有的注入点。

## 后果

- 仅因 JSON 字符串字节非法而失败的 Grok 或其他 OpenAI 兼容流，会成为一次工具调用，而不是本轮失败。
- 闭合被截断的字符串可能得到不完整的参数对象；由工具 schema 而不是该 walker 拒绝它。
- fetch 包装在流生命周期内是进程范围的。在同一 isolate 中 stub `globalThis.fetch` 的测试不得与正在进行的适配器流重叠；Vitest forks 使单元文件隔离。
- 事件解析之后，pi-ai 仍负责参数对象修复；本层只让事件可解析。
