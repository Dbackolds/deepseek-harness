# Agent Note: 设置页显示 Host 启动时间与启动次数

Status: implemented

[English](2026-08-29-settings-host-start-meta.md) | 中文

## 问题

设置内容栏标题左侧留白。排查存活 Host（包括自动化显示已到期却不开火）时，看不到本次进程何时启动，以及这个 home 已经启动过多少次 Host。

## 决策

`ui-settings-general` 的 Host 半边注册 `ui-host`，持久保存 `startCount` 和当前进程的 `startedAt` UTC 时刻。一个 Node 进程里第一次注册 settings 时把 `startCount` 加一并写入该进程启动时刻；同一进程里的后续注册只刷新 `startedAt`，不再加一。设置内容栏标题在该 section 就绪后显示这两项。

## 考虑过的替代方案

**放到 `ConnectionHostInfo`。** 不予采用：opening frame 目前只带 `home`；启动次数必须活过重连和进程重启，应写在用户设置文档里。

**注册为 `settings.action`。** 不予采用：该列表是 `margin-left: auto`，会和「打开配置文件」挤在右侧，填不满标题左侧留白。

## 后果

`settings.yaml` 会出现 `ui-host` section。未加载本插件的 Host 不记录。捕获设置对话框的 snapshot golden 会包含这条本地化 meta。

## 测试

- `packages/client/ui-settings-general/tests/host.client.spec.ts` 证明每个进程只加一次。
- `packages/client/ui-settings-general/tests/host-start-meta.client.spec.ts` 以及组件／root spec 覆盖隐藏与就绪状态。
