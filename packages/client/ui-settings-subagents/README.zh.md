# dsh-client-ui-settings-subagents

[English](README.md) | 中文

**子代理**设置分区。该页拥有用户定义库：创建、编辑、删除可复用的子代理 persona 与可选工具过滤。

写入走 `user-subagents` 命名空间上的 `settings.replace`。Host 插件 [`dsh-user-subagents`](../../subagent/user-subagents/README.md) 提供实时库；[`dsh-tool-subagent`](../../subagent/tool-subagent/README.md) 在启动时应用所选定义。

导航行位于模型与插件之间（`order: 12`）。未暴露该命名空间的部署渲染不可用说明，而不是编辑器。

## 模型体验

无。该分区渲染浏览器配置 UI；它写入的值只通过 `dsh-user-subagents` 和 `dsh-tool-subagent` 到达模型。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **工具名需手写**——该页不列出实时的全局工具目录。
- **一条定义不能选择提供方或模型**——这些仍由工具实例配置决定。
