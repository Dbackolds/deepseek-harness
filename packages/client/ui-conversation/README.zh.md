---
description: "Target-neutral 对话装配与浏览器 shell：事件和视图注册表、逐会话 binding、输入状态、slot 与临时 composer takeover。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-conversation

[English](README.md) | 中文

## 概述

`ui-conversation` 拥有与 target 无关的 Conversation 组装和共享浏览器 shell。它消费 Session Controller 的 `SessionEventLikeEntry` feed，通过 `ctx.uiConversation` 暴露不依赖 React 的 registry 与逐 Session binding，并通过 `ctx.uiSession` 提供 `useConversation`、`useInput` 和 `inputActions` 标准 props。它还拥有按会话的持久化图片 URL 缓存：`ctx.uiConversation.imageUrl(sessionId, attachment)` 为每个附件解析一个经会话授权的浏览器 URL，并随 Session binding 释放而撤销，因此所有 Conversation target 共享一次 `session.attachment` 读取。Chat 等具体 target 位于独立 package，由各自 package 注册 Definition、snapshot builder、View 和 renderer。

## 目录

- [Conversation 组装](#conversation-assembly)
- [Shell 与标准 props](#shell-and-standard-props)
- [临时 composer entry](#temporary-composer-entries)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="conversation-assembly"></a>
## Conversation 组装

`UiConversation.events` 是 event Definition 的唯一 registry，`UiConversation.views` 是 target snapshot builder 的唯一 registry。两者都拒绝重复 key、保持注册顺序、返回幂等 disposer，并在 contribution roster 变化时重建现有 binding。`UiConversation.binding(bindingOrSessionId)` 为当前 Session Controller binding 返回 identity 稳定的 Conversation binding，不会另开 event source。

adapter 把每个 `SessionEventLikeEntry` 直接交给 assembler。外层 `type` 区分 scalar 与 packed record，内部 `event` 则统一公开 `type`、`seq`、`time` 与 `data`；Definition 接收这个内部 `SessionEventLike`。历史 replace 与 prepend 接受两种 entry，实时 append 只接受 `SessionLiveEventEntry`。两种 event 都使用 Definition 的同一组 `match` 与 `update` 方法，`start` 则只接收标准 event，assembler 会拒绝 packed start。不消费 Assistant delta 的 Definition 对 packed tag 返回 `null`。replace window 或 revision 断档从完整已加载窗口重建；连续 revision 的 append 和 prepend 使用增量组装，并且不展开 packed member。assembler 拥有 Context 匹配、Turn/Step location、target node 物化、target activity 和稳定 target source。`ConversationSnapshot` 只包含与 target 无关的 View 与 active-target 事实；Session lifecycle 状态仍属于 `SessionSnapshot`。

shell 选择解析出 target 或 target source 收到首个 subscriber 时，该 target 进入 active 状态。assembler 从当前 Context 对它执行一次 replace，并使它参与后续增量 flush；创建 source 不会激活 target，取消订阅也不会停用 target。

target package 通过 declaration merge 扩展 snapshot 与 Location data map，再调用 `ctx.uiConversation.events.register(...)` 和 `ctx.uiConversation.views.register(...)`。target 通过 `ctx.uiConversation.binding(binding).target(targetId)` 读取其 Session-owned source。注册属于 Cordis effect，返回的 disposer 从同一个 registry 移除 contribution。

<a id="shell-and-standard-props"></a>
## Shell 与标准 props

本包注册 optional-Session `conversation` shell、strict Session header/body、View list、composer chain 与 bar、输入区域、Hero 区域、queue dock、草稿持久化和 phase 计算。`ctx.uiSession.provide()` 从同一个 Session binding 物化 Conversation 与 input source，并将 `inputActions` 作为稳定标准 prop 提供。

View 选择规则固定：有效且已注册的持久化选择优先，其次是已注册的 `chat`，否则不渲染 View；绝不选择第一个已注册 View。Shell phase 只组合 Session lifecycle 与 active-target set，不读取任何 target-specific snapshot。

Session 首次绑定或缓存的 Session 成为 current 时，shell 会在渲染前读取持久化 View 偏好，激活已注册的偏好 View 或 Chat fallback，并在后续 tab 或 focus 选择写入 store 前先激活对应 target。blank Session 仍不渲染 `conversation.view` slot；未选中的 target 不会激活。

常驻 composer 在无 Session 与有 Session 之间保持挂载。无 Session 时，同一个编辑器表面保持 inert，Workspace picker 连接 blank Session。该表面是 shell 所有的 Lexical 编辑器：引用 chip 是携带 owner 序列化身份的原子 decorator 节点（提交时经 owner codec 展开），已认领的 slash command 保持为带样式的行首文本，文件夹文本引用以图标前缀携带文件夹图形，草稿的剪贴板投影镜像到逐 Session Conversation store。Queue 操作通过 scoped `ctx.conversation` service 寻址准确的 queue occurrence；queue 预览经 `ui-primitives` 的共享行内引用投影渲染已发送文本（wire 会话形式折叠为其标签），并把本地图片预览或持久化图片部分显示为缩略图，编辑态则展示字面发送文本。持久化缩略图通过会话图片 URL 缓存解析。繁忙时 Enter 行为保存在 Host-backed `ui-conversation` settings namespace。

默认发送采用乐观提交：Enter 在同一事务里清空草稿、occurrence 表和撤销历史，composer 保持 `plain`，发送作为 detached attempt 运行，发送期间可以继续输入和提交。`sendSession` 在序列化之前用投递模式注册 Session 提交回显（`session.beginSubmission`）；Session 根据该模式与当前运行状态推导位置，因此空闲发送进入 transcript，繁忙时 Queue 进入 QueueDock，繁忙时 Steer 进入 pending-steering 区域。随后让出一帧，图片经浏览器原生 `FileReader` data-URL 路径编码。多个并发发送失败时，在用户编辑还原内容之前按提交顺序合并还原；命令提交保持冻结的 `submitting` 阶段。Detached attempt 持有图片 id，直到 admission 完成或 Session scope 销毁。回显以 observed 退休时，durable 图片缓存立即公开预览 URL，同时读取 admitted 附件，随后用规范化 URL 替换预览，并在两个 URL 各自停止使用后撤销。直接 subagent continuation 不创建本地回显，因为其 transport 不保留浏览器 request id。

普通 composer 运行时，如果草稿为空或输入不可用，主指针操作保持为 Stop。可提交的文字或附件会把同一位置切换为 Queue Send；清空或成功提交草稿后恢复 Stop。繁忙态 Enter 设置继续选择 Queue 或 Steer 键盘操作。可继续 subagent 保留独立的 Send 与 Stop 操作（[决策](../../../.agents/notes/implemented/bug-fix/2026-08-20-running-draft-primary-send.zh.md)）。

<a id="temporary-composer-entries"></a>
## 临时 composer entry
`QueueDock` 是 `order: 20` 的末端 input-dock 条目。队列为空时隐藏；只有一个待处理项时直接渲染该行；存在两个或更多待处理项时，默认收起为 `"<n> 条排队消息"` 表头，其按钮可展开或收起完整列表。表头暴露 `aria-expanded` 和 `aria-controls`；展开后的列表以 180px 为高度上限，并可滚动。存在进行中的编辑或变更时，列表行会保持可见；队列清空后，下一次出现队列时会恢复默认收起状态。普通会话中的每条可见行仍是单行预览，并提供针对精确单次入队项的编辑、删除和严格 steering 操作。普通会话中有两条或更多行时，行也可通过 HTML5 拖放重排：把一行拖到另一行的上半或下半会对该精确单次入队项发送 `updateQueue({ kind: 'move', beforeItemId? })`，客户端不做乐观重排。已寻址 subagent 则保留只读行，因为其继续执行传输不提供 Queue 变更。如果严格 steering 输给已关闭的窗口，原单次入队项会留在 Queue 中正常投递；如果驱动器已经认领该项，正常投递就已开始。这两种已收敛的竞态都不显示失败，传输和未知错误仍会显示。

`conversation.composer` 是通用 chain，其完整 owner currency 为：

```ts type-equiv
/** Owner values used to elect a composer takeover. */
interface ComposerChainProps {
  /** Current Session identity used by temporary business-owned entries. */
  sessionId: SessionId | undefined
  /** Current Session lifecycle state, absent without a selected Session. */
  session: SessionSnapshot | undefined
  /** Effective business-owned interaction awaiting the user in this Session. */
  pendingInteraction: SessionPendingInteraction | undefined
}
```

业务 package 可仅在一个 Remote waterfall request pending 期间安装 entry：

```tsx
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChainSelect, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

interface Request {
  readonly sessionId: SessionId
}

type RequestComposerProps =
  PropsRuntime<'conversation.composer'> & { matched: Request }
聊天统计行的 token 账目来自经标准套件 `useProjection` 读取的通用 token-meter 投影 `tokenUsage`：计费输入为未缓存输入、缓存读取与缓存写入之和；缓存命中率以缓存读取除以该总量。所有非空比率都先按整数舍入。非满命中只有在当前精度会舍入成 100% 时才增加小数位，并在首次得到低于 100% 的结果时停止；只有完整缓存命中才显示 100%，且精度没有固定上限。轮次与步骤计数、LLM（大语言模型）与工具墙钟时间、以及延迟／吞吐分组都来自全日志的 `sessionStats` 投影（Host 端从步边界、首 token chunk、工具配对与已组装消息折算），因此分页与压缩都无法改变统计条的任何数字；未组合该单元的装配回退为对可见节点做窗口折算，其字段与投影一一对应。统计条把每个有完整记录的步骤的 TTFT（首 token 延迟）取平均，并用采样到的输出 token 数除以其解码时长之和，得到经 `conversation` locale 命名空间本地化的延迟／吞吐分组（中文为 `首 token 平均 … · … tok/s`）；缺少某个 timing 边界或 usage 采样的步骤会直接退出这些数字，而不是让它们失真；压缩（compaction）使已加载窗口不再包含 assistant 节点时，持久计数、token 与上下文分组仍保持可见。轮次计数、步骤计数、耗时、缓存与 token 各项的标签也使用同一命名空间。每个已结算轮次还会在其 assistant footer 的 `用时` 之后追加 `首 token {s}秒 · {tps} tok/s` 标签——即该轮次首个步骤的 TTFT 与轮次聚合的解码吞吐——仅当该轮次的 timing 位于已加载窗口内才显示（窗口是日志的连续后缀，因此窗口内的轮次必然带着它的全部步骤），未记录的数字会各自省略。已落盘的用户、steering（中途引导）和 assistant 行还会在消息带上绘制始终可见的事件时钟（`h:mm` 加本地化上下午，过午夜后加宽出日期）：紧贴用户／steering 气泡左缘，以及 assistant 叙述右侧（[决策](../../../.agents/notes/implemented/feature/2026-08-20-web-always-visible-message-clock.zh.md)）。未组合 token-meter 的部署会整组省略 token 分组；统计行过长时以省略号截断，仅在内容真的被裁切时由延迟 hover tooltip 承载完整文本。上下文占用率渲染为 composer 尾部的 ContextMeter：模型座位之后的一枚 14px 占用圆环，由 `contextPressure` 供数，仅当分子与路由容量都已知时才渲染；点击弹出的面板把「已用百分比」标题与 `~已用 / 容量` 数字，与来自 `contextBreakdown` 投影、带 `~` 前缀的启发式组成明细行（系统提示词、工具、对话消息）及分色分段进度条并列。圆环与标题读取 `projectedTokens`——把提供方样本沿此后表层的增减推进到当下——因此压缩会立刻反映出来，而不必再等一整轮；组成明细行仍是纯启发式，因此加起来依然不等于标题数字（[原理](../../llm/token-meter/README.zh.md)）。占用率是刻意为之的近似值：分子与容量是两个相互独立的「后写覆盖」投影字段，并非同一次请求的原子观测。

const select: ChainSelect<ComposerChainProps, Request> = owner =>
  owner.sessionId === request.sessionId ? request : null

const dispose = ctx.slots.register(
  { name: 'conversation.composer', select },
  RequestComposer,
)

try {
  return await request.result
} finally {
  dispose()
}
```

selector 必须是 owner currency 的纯函数。非 null 返回值作为 `matched` 传给组件；`PropsRuntime<'conversation.composer'>` 提供标准 Session 与 global props。Chain 顺序仍按 `priority` 升序，再按注册顺序；首个返回非 null 的 selector 获选。Shell 会在 takeover 下保持默认 composer 挂载。Request 状态、listener、response encoding 和任何 request-specific child slot 都属于业务 package，不进入 `SessionSnapshot`，也不由 core package 声明。

<a id="model-experience"></a>
## 模型体验

无，因为本包渲染浏览器状态，并通过 Session Controller API 发送用户确认提交的输入，而不构造模型请求。

#### KV Cache 影响

无；Conversation 组装和浏览器输入状态不会改变提供方侧的 prompt cache。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>

- **只有已注册 target 可以渲染**——除已注册的 `chat` 偏好外，shell 刻意不提供隐式 fallback target。


<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
- **统计行的回退折算只覆盖窗口内消息流**：未组合 `sessionStats` 投影单元的装配中，所有数字由快照的 assistant `timing` 与工具 call/result 配对折算，落在已加载事件窗口之外的节点（更早的历史）不计入，数字随加载页数增长。
- **详情面板没有入口**：`ChatViewInjected.openDetails` 虽已实现却无人调用，因此以原始形式显示已选择调用的那部分在组装后的应用中不可达。没有 Input/Output/Metadata 切换、Prev/Next 步进，也没有 trajectory 深链接。
- **assistant 逐消息分页是预留 slot**：设计中已有图稿，尚未实现。已定稿的内容 IconActions 行（复制／时钟／分支）只挂在每个已结束轮次中最后一条带 text 内容的 assistant 下；轮次中间的叙述、纯 Think 节点，以及仍在产出步骤的轮次里的所有节点都不带 chrome。除非该消息同时也是已完成轮次的最后一个 transcript 节点，否则分支保持禁用；启用后，它会 fork 到该轮次末尾，在 client 端递增继承标题并打开子会话。fork 或改名失败时源会话保持选中（[决策](../../../.agents/notes/implemented/bug-fix/2026-08-02-message-fork-actions-require-completed-turn-tail.zh.md)）。
- **已定稿的 user prompt 在同一会话内编辑**：user 气泡显示时钟、复制和编辑；分支仍只存在于 assistant 回答之下（[决策](../../../.agents/notes/implemented/simplification/2026-08-06-user-bubbles-drop-the-branch-action.zh.md)）。保存已定稿 prompt 会调用 `session.rewrite`，在本会话替换该 prompt 及其后 surface 节点，并从替换消息开启新一轮（[决策](../../../.agents/notes/implemented/feature/2026-08-20-same-session-user-prompt-rewrite.zh.md)）。steering 与待处理气泡仍只有复制；队列编辑仍是待处理 inbox 操作。
- **others 工具行的闪光图标是手绘近似版本**：无法在本地导出设计字形的矢量几何；等到存在精确导出后再将其提升到 ui-primitives。
- **审批面板的「始终允许此类」暂缓**：持久授权需要授权存储设计；今天只能回答允许一次／拒绝。
- **TodoPanel 将过长条目截成单行省略号**：figma 条没有换行或展开入口，完整文本无法在行内读完。
- **Queue 编辑只改写文本**：内联编辑器只发送一个文本块；宿主保留已准入的图片和其他非文本块。进入编辑模式后，删除和严格 steering 操作会被保存和取消取代；Enter 保存，Escape 取消。
- **Queue 严格 steering 会保留完整消息**：agent 运行期间，steering 操作会以原子方式把所寻址的 Queue 单次入队项转移到当前 next-step 窗口。包含混合内容的行仍可使用此操作，因为它会转发不可变消息，而非文本投影。带 placement 的 Host 快照会在会话流末尾渲染待处理 steering，直到已消费的 `user/message` 折叠进持久 transcript（文本记录），因此立即展示、重连和回放共享同一个线性权威。
