# Agent Note: Web 聊天在消息行右侧常显时钟

Status: implemented

[English](2026-08-20-web-always-visible-message-clock.md) | 中文

## 问题

Web 聊天已经保存每条消息的事件时间，但时钟藏在 IconActions 行里，并且只在悬停时淡入。扫读 transcript（文本记录）时，不把指针移到每一行就看不出这一轮发生在何时，这与 Grok TUI 把淡色时钟固定在每条消息右侧的模式相反。

## 决策

每条用户、steering（中途引导）和 assistant 消息行都把事件时钟渲染为行尾始终可见的 `<time>` 标签。`MessageClock` 通过 `formatMessageClock` 格式化 `node.time`，并直接坐在消息带上：用户／steering 气泡把时钟放在气泡右侧，assistant 叙述把它放在 markdown 正文右侧。同一公历日打印 `h:mm` 加上本地化上下午（`上午`／`下午`，`AM`／`PM`）；同年更早的日期前置 `clock.md` 日期模板；跨年前置 `clock.ymd`。`useCalendarDay` 仍在本地午夜后加宽标签。尚未落盘的 pending steering 没有持久事件时间，因此不挂时钟。

IconActions 行不再拥有时钟。已结算轮次的指标（`用时`、TTFT（首 token 延迟）、tok/s）仍留在该行，有值即可见。复制与分支仍是始终可见的图标控件。

## 考虑过的替代方案

**把时钟继续留在 IconActions 行、只改样式并保持悬停显示。** 否决：需求是 Grok TUI 的扫读模式——不用悬停就能读到时钟——页脚时钟仍然远离消息正文。

**把现有 24 小时 `HH:mm` 改成 12 小时，但不移动标签。** 否决：缺的是位置与可见性，不只是数字写法。12 小时制是对齐该 TUI 的一部分，不能代替把时钟挪到消息行上。

**显示一个与消息事件无关、自己跳动的墙上时钟。** 否决：transcript 时钟是已记录的事件时间。自由走动的「现在」标签会与回放、分页以及 `useCalendarDay` 已经拥有的午夜加宽不一致。

## 后果

每条已落盘的用户和 assistant 行在静止状态下都能读到到达时间。时钟不再由悬停门控，因此会像 TUI 那样与内容并列。assistant 指标仍留在 turn-tail 操作行上，不再粘在一条隐藏时钟后面。Web aria golden 仍把每一种时钟形态折叠为 `{{clock}}`；归一化器接受带本地化上下午的 12 小时形式。
