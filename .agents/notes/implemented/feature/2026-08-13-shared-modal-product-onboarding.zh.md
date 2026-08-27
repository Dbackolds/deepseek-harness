# Agent Note: 共用弹窗的产品引导

Status: implemented

[English](2026-08-13-shared-modal-product-onboarding.md) | 中文

## 问题

首次使用引导混用了两种交互：产品背景说明占满整个视口，凭据提示则先把用户带进「设置」，之后才能输入密钥。一个很短的有序流程因此像两个互不相关的界面，引导 UI 的归属也分散在多个包中。产品仍需要在提供方配置之前显示版本化的测试阶段声明，但恢复它不能增加第二个独立浮层，也不能改变 Host 的设置与凭据边界。

## 决策

**由同一个既有 client Cordis 插件持有已发布的首启步骤。** `ui-settings-models` 在 `settings.onboarding` 中以顺序 `-100` 注册 `welcome-notice`。外壳仍然只挂载第一个未完成条目。不新增 client 包或插件配置行。

**声明使用同一个弹窗组件。** `OnboardingModal` 包装既有 ui-primitives `Modal`，提供统一的标题和内容布局，并只在可见期间持有 `#root` 的 inert 状态。Escape 和遮罩点击不会静默完成强制引导；该步骤只暴露自己的明确「继续」操作。步骤仍在加载私有事实时返回 `null`，因此不会绘制或阻塞界面。

**欢迎声明复用既有持久化字段。** 完整文案与版本由 `onboarding-copy.ts` 持有。回环客户端通过既有 settings API 比较和写入 `ui-onboarding.welcomeNoticeVersion`，且只有点击「继续」才确认当前版本。非 loopback 页面继续使用既有的进程内回退，因为 Client 在那里禁用 Host settings 持久化。不改变 Host schema、API Proxy 允许列表或持久化实现。

**API 密钥在 Models 页填写。** [移除首次启动凭据弹窗](../simplification/2026-08-15-remove-first-run-api-key-dialog.zh.md) 删除了 DeepSeek 官方的 `settings.onboarding` 步骤。缺失密钥表现为 Models 设置卡片或缺失密钥行，而不是产品接管。

## 曾考虑的替代方案

**让声明与后续任何首启步骤分别成为 client 插件。** 不采用：产品要求只使用一个 client Cordis 插件，且声明已经与 Models 共享文案、顺序、弹窗框架与失效刷新归属。

**把确认逻辑移入新的 Host API。** 不采用：既有 settings 契约已经能表达所需状态与写入；新增 endpoint 只会扩大范围，不会增加用户能力。

**保留此前占满视口的展示层。** 不采用：本次需要的是叠加在当前应用上的弹窗，既有 ui-primitives modal 已提供合适的 portal、遮罩与无障碍契约。

## 后果

新的回环 profile 会先看到指定的内测声明；仅当没有任何可用提供方时，之后才会出现行内 DeepSeek 密钥弹窗。确认仍按版本写入 `settings.yaml`，secret 仍以只写方式存入 `.credentials.yaml`，已就绪或无法修复的部署在加载判定期间不会渲染任何引导框架。Models 包现在同时持有产品引导展示与提供方配置；README 和浏览器覆盖明确记录了这项扩展后的职责。本决策在历史上的[全屏内测声明移除](../../archived/simplification/2026-08-13-remove-first-run-beta-notice.md)之后恢复简洁的测试阶段声明，但不会恢复那份声明中的遥测文案或接管式布局。
