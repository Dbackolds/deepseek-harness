# Agent Note: Sidebar account menu split trigger

Status: implemented

[English](2026-09-12-sidebar-account-menu-split-trigger.md) | 中文

## Problem

侧边栏底部账号条原本是一个整块「设置」按钮。点账号名和点右侧齿轮都会打开设置面板，无法像对照产品那样单独打开账号菜单。

## Decision

展开栏里，`SettingsRoot` 把底部控件拆成两个并列按钮。左侧按钮是账号菜单（界面语言、界面主题、界面缩放），锚在账号条上方。语言子菜单是系统默认加已注册语言；主题是系统默认、深色主题、浅色主题；缩放是放大 / 缩小 / 实际大小，作用在会话内容字号范围上。右侧按钮仍是设置齿轮，并保留本地化的「设置」无障碍名称。不用覆盖层命中区：每个按钮接收自己的指针事件。收起轨仍用单个圆形账号标打开设置。

菜单通过注入的 `setLocale` / `clearLocale` / `setTheme` / `setFontSize` 写入，并从外壳 inject hooks 读取 locale 与 theme 快照。`LocaleSnapshot.preference` 区分显式选择与浏览器派生语言，这样「系统默认」才能显示勾选。带子菜单的行显示右箭头；选中的子项显示勾选。没有「断开连接」命令，因为 Connection 只暴露 reconnect，没有用户主动断开。

## Alternatives considered

**保留一个按钮，用长按或右键打开菜单。** 否决：需求是两个独立点击区，对应账号条上已经画出来的左右分区。

**语言、主题、缩放只放在设置面板里。** 否决：这样左侧账号条除了打开和齿轮相同的面板外没有自己的动作。

**为菜单的「断开连接」增加 Host disconnect RPC。** 否决：Connection 没有用户主动断开；放一个无效行会变成可见的假能力。

## Consequences

- 展开栏里按「设置」无障碍名称点击的 e2e 调用方仍打开设置面板。
- 收起轨不显示账号菜单。
- 设置外壳除 locale 与 connection 外，还注入 theme 服务。

## Testing

`ui-settings-general` 组件测试点击「账号菜单」时不打开对话框，再分别应用语言、外观、缩放子菜单选项。收起轨测试确认没有账号菜单。`ui-primitives` Menu 测试覆盖子菜单右箭头。
