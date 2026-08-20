# @deepseek-ai/dsh-client-ui-settings-skills

[English](README.md) | 中文

**Skills** 设置分区。该页列出 Host 注册表当前发现的全部 skill（技能）——内置提供方（如 `dsh-badge`）、用户与项目文件系统根，以及运行时贡献——并以可搜索的折叠卡片展示。它不注册斜杠命令，也不写入任何内容。

导航行位于插件与 Agent 预设之间（`order: 17`）。首次挂载调用 `skill.catalog`；该 RPC 不绑定会话，并把宿主全局层与部署默认 preset 的 standing 层合并，因此即使 Web 组合禁用了宿主的 `skill-filesystem` 行，仍会显示 preset 拥有的用户、项目与 bundled skill。

每张收起的卡片显示 skill 名称、说明与来源标签。展开后会列出起源桶、提供方名称以及两项调用标志。加载、空结果、无匹配结果与通用失败状态只属于已挂载组件；读取失败后可以重试，且不会暴露传输细节。

## 模型体验

无。该分区渲染浏览器目录；调用仍是普通的 `/name` 提示，由 `dsh-tool-skill` 处理。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **只读目录**——该页不能创建、编辑、删除或开关 skill。
- **每次 Settings 挂载或重试只读取一份快照**——该页不订阅 `skills/change`，也不会在重连后自动重新读取。
