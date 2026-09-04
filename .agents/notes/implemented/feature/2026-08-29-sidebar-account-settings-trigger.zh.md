# Agent Note: 侧边栏账号设置触发器

Status: implemented

[English](2026-08-29-sidebar-account-settings-trigger.md) | 中文

## Problem

侧边栏底栏是一整行「设置」：齿轮加「设置」二字。它读起来像设置页入口，而不是这块 Host 所属的本机账号。对照 ZCode 的账号条（首字母、用户名、右侧设置图标），这个差异很明显。

## Decision

`ui-settings-general` 的 `settings.trigger` 占用方是账号条。可见名称取连接 generation 的 Host `home` 最后一段路径（POSIX 或 Windows）；home 缺失时用本地化的「本地」/ Local。展开栏显示该名称和右侧设置图标；收起轨只显示圆形首字母。「设置」文案仍留在树里并视觉隐藏，因此设置点击区的无障碍名称仍是「设置」/ Settings，现有 `getByRole('button', { name: '设置', exact: true })` 调用方继续有效。账号名带 `aria-hidden`。触发器按 Tool 和 Workspace 的同一方式注入 `connection.generation`。展开栏后来把账号条与齿轮拆成两个点击区；见 `2026-09-12-sidebar-account-menu-split-trigger.md`。

这不是登录。连接 generation 仍然只发布账号 home 路径；账号条从该路径派生显示用户名，不在线路上新增 username 字段。

## Alternatives considered

**用树外插件替换 `settings.trigger`。** 否决：底栏是随产品发布的界面框架，不是可叠加的 footer action；每个 Web 安装都要装插件才能对齐所要的产品外观。

**把账号条放进 `sidebar.footer.action`，与「设置」并列。** 否决：那会保留「设置」行，再多一个底栏控件。

**给 generation 的 Host 事实增加 `username`。** 否决：home 路径已经能命名本机账号，显示不需要新的线路字段。

## Consequences

- 展开触发器的可见文案是账号名；「设置」只作为无障碍名称保留。
- 收起轨触发器是首字母圆标，不是齿轮。
- 发布 `home` 的 fixture 与真实 Host 显示该路径最后一段；缺失描述时显示「本地」/ Local。

## Testing

包测试覆盖 POSIX 与 Windows 的 home 解析、展开态账号条加隐藏的「设置」名称、收起轨只有圆标没有可见名，以及触发器注入 `connection.generation`。Web lifecycle-chrome 快照保留 Settings 无障碍名称，并省略现已隐藏的设置图标。
