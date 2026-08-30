# Agent Note: Windows reveal menu uses File Explorer wording

Status: implemented

[English](2026-08-30-windows-reveal-explorer-label.md) | 中文

## Problem

Session 右键菜单里“在 Host 路径中显示”的文案两边都写成了 macOS Finder：中文 `在 Finder 中打开`，英文 `Reveal in Finder`。Windows Host 实际打开的是资源管理器，Finder 名称对不上桌面应用。

## Decision

`packages/client/ui-workspace` 保留 locale key `menu.revealInFinder`，只改可见文案：

- 中文：`在资源管理器打开`
- 英文：`Reveal in File Explorer`

包内 README 双语对也写同一菜单文案。行动作 id 与 `onReveal` / `openPath` 接线不变。

## Alternatives considered

- **按 Host 平台拆 locale key，并用 `host.describe` 切换标签。** 对混合 Host 机群更准确，但这次只要当前 GUI 的 Windows 产品文案；`host.describe` 仍只暴露 `canOpenPath`，没有桌面应用名。
- **把 locale key 从 Finder 改名。** 会牵动所有 `menu.revealInFinder` 消费者，却不改变行为；key 继续当内部标识即可。
- **继续把 Finder 当通用“显示”隐喻。** 菜单点名的是真实桌面应用；在 Windows 上就是资源管理器 / File Explorer。

## Consequences

Windows 用户看到本机文件管理器名称。复用同一套词典的 macOS / Linux 构建也会暂时显示 File Explorer 文案，直到以后做 Host 感知标签。Reveal 行为不变。

## Testing

`packages/client/ui-workspace/tests/rows.client.spec.tsx` 点击中文菜单项 `在资源管理器打开`，并继续断言 `onReveal` 收到 Session 的 cwd。