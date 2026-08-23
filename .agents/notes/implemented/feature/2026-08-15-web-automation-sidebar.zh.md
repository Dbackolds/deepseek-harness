# Agent Note: Web Automation 侧栏

Status: implemented

[English](2026-08-15-web-automation-sidebar.md) | 中文

## 问题

Host Automation 已经拥有持久规则、Host RPC 和模型 tool，但 Web GUI 没有产品入口。人要查看或创建规则，只能让模型去调 tool。[Host 拥有的 Automation 开火](2026-08-15-host-owned-automation-runs.zh.md) 把 Settings UI 留作同一服务上的后续工作。

## 决策

`ui-sidebar` 在 New Session 下方声明 `sidebar.automation`。`@deepseek-ai/dsh-client-ui-automation` 占据该 seat，用与 New Session 同几何的时钟图标触发器，并在 `shell.overlay` 打开中间栏整页，走现有 `automation.*` 线路：列出、创建（恰好一种 after / at / every / local-clock）、启用、立即运行、删除规则和删除运行记录。Host 仍是事实来源。集合不进 Settings，因为产品请求是 New Session 的兄弟。

创建停留在服务已接受的四种选择器上。内置模板只预填该表单，提交前不持久化规则。保持唤醒开关写入 Host 的 `ui-automation.keepAwake`；存活的宿主随后持有操作系统休眠断言，关掉开关或卸载插件时释放。表单不解析自然语言。点击卡片主体（不只是标题）进入该规则的设置与历史；设置通过 `automation.update` 保存。历史列出 `endedAt`、`source`，并可通过 `automation.deleteRun` 删除一条过去的运行。成功的立即运行会等到 Host 列表带上新 Session，再关掉自动化页并打开该 Session；跳过或失败的开火留在本页。每次打开页面都会向 Host 拉取一次列表。

## 考虑过的替代方案

**Settings 分区。** Host 笔记把 Settings 当作后续的人机界面。设置页会把集合再藏进一次点击，也不符合“放在 New Session 下面”的请求。

**Settings 旁边的页脚动作。** 页脚动作是附加的，坐在栏底。请求是 New Session 的兄弟。

**折进 ui-sidebar。** 外壳只拥有几何。Host 支持的集合是功能插件，与 ui-jobs、ui-settings-models 一致。

## 验证

包测试覆盖 slot 注册与 HMR 拆除、store 的 list/create/update/enable/run-now/delete 与页面开合、运行次数加载、选中规则的设置与历史页、成功立即运行等待 Session 列表再打开、选择器摘要、剩余时间芯片、草稿校验、保持唤醒偏好与操作系统持有、模板叠加，以及触发器加中间栏整页。Web e2e 场景通过真实 Host 创建一条 `after` 规则，并在整页里断言它。侧栏外壳快照包含空的 `sidebar.automation` hole。

## 后果

开火产生的 Session 仍以 `origin: 'automation'` 出现在普通列表里。页上的立即运行也会选中该 Session；尚未开始 turn 的 Session 仍不会出现在列表里。停掉的 Host 仍然不会开火。模型 tool 仍是在活的 root 回合里创建规则的唯一路径。
