# 子代理与 Job 投递设置

[English](subagent-delivery-settings.md) | 中文

运行时通知在繁忙态下的用户可配置投递合同。

## Problem Statement

作曲器繁忙 Enter 已经通过 Host settings 持久化。可继续结算、子级 `report` 和后台 Job 完成仍在代码里选择父级 inbox 投递位置。因此，已经在工作的父级无法选择这些通知进入最近一步，还是等到下一轮。

## Solution

设置 → 子代理增加「行为」组，三个独立的繁忙态选择器。各自写入 `$DSH_HOME/settings.yaml` 中的 Host 分节。下一条发往在线父级的通知遵循已存储的选择。空闲父级始终开启后续一轮。已在拆卸中的父级仍接受注入，且永不被唤醒。

## User Stories

1. 作为操作者，我希望结算、report 和 Job 通知各自有独立的繁忙态选择，这样一条吵的通道不会强迫另外两条。
2. 作为操作者，我希望 Steer 表示「当前步之后」，这样正在进行的生成或已派出的工具不会被中止。
3. 作为操作者，我希望 Queue 表示「当前轮之后」，这样父级可以先结束自己的工具循环。
4. 作为操作者，我希望空闲父级在每条通知上都被唤醒，这样停驻的父级仍能得知结果。
5. 作为操作者，我希望改动对已经在跑的会话的下一条通知生效，这样不必重启 dsh 就能试另一种投递。
6. 作为操作者，我希望三个选择通过 `settings.yaml` 在刷新和重启后仍在，这样该页不是一次性覆盖。
7. 作为操作者，我希望「行为」组在定义库上方，这样键盘 Enter 仍留在通用设置。
8. 作为 snapshot 作者，我希望部署侧 `quiet` 开关保留，这样确定性 transcript 不会多开一轮。

## Implementation Decisions

- 命名空间：`subagent-delivery`。字段：`settlementBusy`、`reportBusy`、`jobBusy`。取值：`steer` | `queue`。每个字段的 schema 默认是 `steer`。
- Host 注册放在子代理设置插件的 host 半，模式与 `ui-conversation.busyEnter` 相同。该分节是 live，不是 restart。
- 运行时读取方在发送时解析 `ctx.settings.get()`。缺少 settings 服务或未注册分节时视为 `steer`。
- 繁忙 + `steer` 调用 `parent.steer()`。繁忙 + `queue` 调用 `parent.followup()`。空闲始终 `followup()`，即使存储字段是 `queue`。
- 拆卸仍注入且永不唤醒，忽略用户字段。
- `tool-subagent-report` 的 `reportDelivery: quiet` 与 `tool-jobs` 的 `completionDelivery: quiet` 仍是部署覆盖。它们只抑制唤醒。它们不把繁忙 Steer 改写成 Queue。
- Job 空闲唤醒仍消耗 `maxConsecutiveWakes`。繁忙 Steer 不消耗该预算。Quiet 投递仍永不唤醒。
- report 在父级繁忙时的默认变为 Steer。结算默认仍是 Steer。Job 繁忙路径从注入改为 Steer。
- UI 文案复用「插话发送 / 排队发送」。行为组说明写明步与轮的含义，以及空闲始终新开一轮。
- 作曲器 `ui-conversation.busyEnter` 不变。

## Testing Decisions

- Host 注册：注册、默认、接受 `queue`/`steer`、拒绝其他值、dispose 后注销。
- 结算：繁忙 steer / 繁忙 queue / 空闲 followup / 拆卸 inject。
- report：wakeup + 繁忙 steer / wakeup + 繁忙 queue / 空闲 followup / quiet 仍注入。
- Job：繁忙 steer / 繁忙 queue / 空闲 followup / quiet 空闲注入 / 唤醒预算不变 / 拆卸静默。
- 设置页：行为组渲染三个选择器；改字段写入 Host scope；库 CRUD 仍可用。
- 持久化：UI 改动后 yaml 含已写字段。若现有 settings-chrome 路径能低成本承载则覆盖刷新；否则 Host 加 client scope 测试即可。

## Out of Scope

- 作曲器繁忙 Enter 的持久化与默认值。
- 中止正在进行的生成或已经在跑的工具。
- 前台 subagent 调用。
- AgentTeams 邮箱投递与 `send_message`。
- 空闲 Quiet 用户选项。
- 按会话覆盖。

## Further Notes

Steer 是最近一步准入，不是取消。落在同一个 next-step inbox 的多条 Steer 通知会一起被认领。

**Steer** 在当前这次生成或已经派出的工具结束后，把一条 user-role 消息准入到最近的后续 step。它不会中止已经在进行的工作。

**Queue** 在当前轮结束后，把一条 user-role 消息作为自己的后续一轮准入。

**Inject** 把面向模型的上下文放到 next-step inbox，且不唤醒空闲驱动。它用于拆卸和部署侧 Quiet，不是用户设置。
