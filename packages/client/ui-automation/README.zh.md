# @deepseek-ai/dsh-client-ui-automation

[English](README.md) | 中文

Web Host Automation 特性的归属方：占据 New Session 控件下方的 `sidebar.automation`，用与该控件同几何的时钟图标触发器打开中间栏整页；整页注册在 `shell.overlay`，列出 Host Automation 规则并创建新规则。数据来自 Host 的 `automation.*` 线路和 `ui-automation` 设置命名空间；本包不另持持久状态。[ui-sidebar](../ui-sidebar/README.md) 声明该 seat，并只传入栏的 `wide` 标志。

触发器始终存在，因此没有规则的 Host 仍有入口。打开页面时加载一次列表；之后的打开复用快照，直到一次变更或连接重置再次拉取。一张卡片显示规则名称、任务文本、列表镜像里有则附上工作区标题、带剩余时间的时间芯片，以及 `listRuns` 给出的运行次数。标题打开最近一次开火的 Session。启用、停用、立即运行和删除都走模型 tool 与 Host RPC 共用的同一 Host 服务。成功的立即运行会关掉自动化页，并在 Host 列表带上该 Session 后打开它。若这次被跳过但已有上次 Session，也会打开那次会话，并仍显示跳过原因。创建恰好接受一种选择器：一次性延迟、UTC 时刻、至少 300 秒的固定间隔，或带 IANA 时区与可选 ISO 星期的本地时钟。内置模板只预填该表单，提交前不持久化规则。保持唤醒开关写入 `ui-automation.keepAwake`。写入完成前，仍携带旧值的 Host 快照不能覆盖这次选择；写入失败则重新采用 Host 值。打开时，存活的宿主持有操作系统休眠断言（macOS 为 `caffeinate -i`，Linux 为 `systemd-inhibit --what=idle`，Windows 为 `SetThreadExecutionState`），关掉开关或卸载插件时释放。助手缺失时不做断言。

样式只用 token。文案走本包自己的 `automation` locale 命名空间。Host 约定见 [Host 拥有的 Automation](../../../docs/subsystems/automation.md)；[Host 拥有的 Automation 开火 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-host-owned-automation-runs.md) 持有服务决策，[Web Automation 侧栏 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-automation-sidebar.md) 持有本呈现。

## 模型体验

无，因为本包为人类渲染 Host Automation 记录，不触及 prompt、消息、schema、流或工具结果。模型对同一批规则的视角仍属于 [`dsh-tool-automation`](../../automation/tool-automation/README.md)。

#### KV Cache effect

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **面板不编辑已有选择器** —— 更新仍需 Host RPC 或模型 tool。创建表单覆盖服务接受的四种选择器。
- **停掉的 Host 不会开火** —— 列表仍显示上一次存活 Host 派生的下次开火时刻；本包不重新计算它们。保持唤醒也随 Host 进程结束。
- **没有操作系统助手时，保持唤醒不能强迫笔记本不睡** —— 缺少 `caffeinate`、`systemd-inhibit` 或 Windows 电源调用时，开关仍可打开，宿主继续跑。
