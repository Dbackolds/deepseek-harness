# Agent Note: 桌面启动页携带 Host 启动错误

Status: implemented

[English](2026-08-23-desktop-loading-page-error-message.md) | 中文

## 问题

`presentWindow` 仍把 Host 启动错误传给 `loadingPage(variant, message)`。`loadingPage` 只接受标题栏变体，因此 `apps/desktop` 的 typecheck 失败，Host 启动失败时也无法把错误画到启动页上。

## 决策

`loadingPage` 接受可选的第二参数。省略或空字符串仍显示 `正在启动 DeepSeek Harness…`。其它字符串先做 HTML 转义，再替换 `.dsh-desktop-loading` 里的那段文案。

## 考虑过的替代方案

**保持单参数页面，用 `String.replace` 拼错误。** 不予采用：启动文案不是稳定契约，且含标记的 Host 消息会未经转义进入页面。

**从 `main.ts` 去掉错误参数。** 不予采用：Host 启动失败时操作者只会停在通用启动页，看不到诊断。

## 后果

桌面 typecheck 与打包可以编译 `main.ts`。Host 拉起或引导失败时显示转义后的错误，而不是启动文案。

## 测试

- `apps/desktop/tests/titlebar.spec.ts` 断言带 HTML 的 Host 错误会被转义并替换启动文案；空消息仍保留启动文案。
