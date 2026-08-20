# Agent Note: Web 设置 Skills 分区

Status: implemented

[English](2026-08-17-web-settings-skills.md) | 中文

## 问题

Web 设置面板没有已发现 skill（技能）的目录。Composer 斜杠补全已经按会话列出用户可调用的 skill，但人要查看内置、用户与项目 skill 时，不应依赖已附着会话或斜杠菜单。把这份目录折进 `ui-skill` 或设置外壳，会把调用与管理缠在一起，并硬编码一条外壳并不拥有的导航行。

## 决策

`@deepseek-ai/dsh-client-ui-settings-skills` 以 `order: 17` 注册 `settings.section` id `skills`，位于插件（`15`）与 Agent 预设（`20`）之间。该页是只读、可搜索的卡片列表，形态参考插件清单：名称、说明、来源标签，以及展开后的提供方与两项调用标志。它不注册斜杠命令。

`skill.list` 仍服务 composer 菜单。设置页读取新的、不绑定会话的 `skill.catalog` RPC。Host 在网关 cwd 上合并全局层与部署默认 preset 的 standing key，并返回每一个已发现 skill——包括 `dsh-badge` 这类内置提供方——不论调用策略。这一合并是必需的，因为 Web bundle 禁用了宿主的 `skill-filesystem` 行；只读全局层会漏掉默认 preset 挂载的用户、项目与 bundled 根。

设置外壳把 `skills` 映射到 `IconSkillOutline16`。未知分区 id 仍共用齿轮图标。

## 考虑过的替代方案

**复用 `skill.list`。** 设置面板没有 `sessionId`，且该 RPC 只返回用户可调用行，也不带 source 与 provider。

**做成与插件清单一样的 Typert Remote。** skill 已有 apiproxy 领域；再建一份清单服务只会重复列举，而不增加仅 Host 才有的能力。

**在该页上创作、开关或注册斜杠命令。** 那些需要可写命名空间或命令注册表，而目录并不拥有它们。第一版只做查看。

**把该页挂进 `ui-skill`。** 那个包拥有 composer 候选与工具行。设置分区是独立的功能插件，与 `ui-settings-subagents` 一致。

## 验证

包测试覆盖分区注册与拆除、来源标签映射、搜索、展开、空状态与重试，以及迟到结果的收容。Api-proxy 测试覆盖 `skill.catalog` schema、载体往返、默认 preset standing 作用域，以及无 roster 时的回退。设置外壳测试包含 `skills` 导航图标。Web settings-chrome 快照包含新的导航行。

## 后果

创建、编辑、删除或开关 skill 仍是文件系统或提供方变更。该页不订阅 `skills/change`；重新打开 Settings 或重试会取得新快照。
