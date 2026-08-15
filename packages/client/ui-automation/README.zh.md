# @deepseek-ai/dsh-client-ui-automation

[English](README.md) | 中文

Web Host Automation 特性的归属方：占据 New Session 控件下方的 `sidebar.automation`，触发器打开一个模态框，列出 Host Automation 规则并创建新规则。数据来自 Host 的 `automation.*` 线路；本包除页面快照和创建表单草稿外不持有持久状态。[ui-sidebar](../ui-sidebar/README.md) 声明该 seat，并只传入栏的 `wide` 标志。

触发器始终存在，因此没有规则的 Host 仍有入口。打开模态框时加载一次列表；之后的打开复用快照，直到一次变更或连接重置再次拉取。一行显示规则名称、派生投递状态、选择器摘要、下次开火时刻、列表镜像里有则附上工作区标题，以及任务文本。启用、停用、立即运行和删除都走模型 tool 与 Host RPC 共用的同一 Host 服务。创建恰好接受一种选择器：一次性延迟、UTC 时刻、至少 300 秒的固定间隔，或带 IANA 时区与可选 ISO 星期的本地时钟。

样式只用 token。文案走本包自己的 `automation` locale 命名空间。Host 约定见 [Host 拥有的 Automation](../../../docs/subsystems/automation.md)；[Host 拥有的 Automation 开火 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-host-owned-automation-runs.md) 持有服务决策，[Web Automation 侧栏 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-automation-sidebar.md) 持有本呈现。

## 模型体验

无，因为本包为人类渲染 Host Automation 记录，不触及 prompt、消息、schema、流或工具结果。模型对同一批规则的视角仍属于 [`dsh-tool-automation`](../../automation/tool-automation/README.md)。

#### KV Cache effect

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **面板不编辑已有选择器** —— 更新仍需 Host RPC 或模型 tool。创建表单覆盖服务接受的四种选择器。
- **停掉的 Host 不会开火** —— 列表仍显示上一次存活 Host 派生的下次开火时刻；本包不重新计算它们。
