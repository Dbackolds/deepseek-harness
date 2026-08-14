# @deepseek-ai/dsh-automation

[English](README.md) | 中文

`dsh-automation` 拥有 Host 级规则：定时器到期时打开一条全新的持久 Session，并提交固定任务。`ctx.automation` 是唯一变更路径。第 1 版接受正整数 `afterSeconds` 延迟、显式 `at` 时刻、至少五分钟的固定间隔 `everySeconds`，或带可选星期的 `local-clock` 墙上时钟。

## 配置

```yaml
- id: automation
  name: '@deepseek-ai/dsh-automation'
  config:
    maxConcurrentRuns: 2
    minEverySeconds: 300
```

`maxConcurrentRuns` 和 `minEverySeconds` 是进程级上限，不是逐条规则设置。缺少 `storageDomain`、`agents`、`sessions`、`workspaceRegistry` 或 `agentDefaultModel` 时插件保持 pending。

## 服务约定

`list()` / `get(id)` 返回带 `state: scheduled | overdue | disabled` 和 `nextAt` 的分离视图。`create(spec)` / `update(id, patch)` / `delete(id)` / `setEnabled(id, enabled)` 变更规则表。`runNow(id)` 开火且不移动下一目标。`listRuns(id, limit?)` 按新到旧返回历史。

创建需要非空 `task`、已存在的 `workspaceId`，以及恰好一个时间选择器。`onOverlap` 默认为 `skip`。省略 `agentPreset` / `permissionPreset` 时，开火使用当时的部署默认值。具名 `permissionPreset` 在 Session 发布之后、入队 prompt 之前通过 `permissionPresets.set` 固定。

开火会创建 `origin: 'automation'` 的 Session，追加仅日志的 `automation/start`，再把 task 作为插件来源的 user message `followup()`。dispatch 表示 prompt 已入队，不表示模型已跑完。一次性规则在成功开火后 disable。周期规则推进到下一个创建锚点或 local-clock 出现时刻，从不回放错过的积压。

`onOverlap: skip` 在上一次 `started` Session 仍有 live 且 `running` 的 Agent 时写入 `skipped_busy`，不再排队另一条 Session。一次性 skip 保留原目标并监视该 Agent 进入 `idle`。周期 skip 仍会推进，避免同一时刻死循环。`onOverlap: replace` 用 `{ kind: 'automation', ruleId }` 和 `{ keepInbox: false }` 取消忙碌 Agent，把旧 run 标为 `replaced`，并立即打开新 Session。

## 模型体验

### 开火会话的 prompt

#### 模型看到什么

新 Session 把规则的 `task` 当作普通 user-role 消息。`automation/start` 仅日志，不进入派生历史。

#### Token 影响

每次开火一条随数据变化的 user message。开火会话不安装管理 schema。

#### KV Cache 影响

这条 prompt 是全新 Session 的第一条 user message，没有可复用前缀。

## 已知限制与推迟工作

- **仅 Host 进程投递** — 规则只在本 Web Host 存活时准时开火；关掉的 desktop 窗口不会做操作系统级唤醒。
- **没有 Cron 语言** — 日历表达式不进入协议；`local-clock` 覆盖每天和按星期的墙上时钟。
- **没有自我繁殖的开火路径** — 本包不注册模型 tool；`dsh-tool-automation` 拒绝来自 Automation 来源回合的 mutate 调用。
