# Agent Note: 移除首次启动 API Key 弹窗

Status: implemented

[English](2026-08-15-remove-first-run-api-key-dialog.md) | 中文

## 问题

没有可用提供方的首次 GUI 启动会先弹出阻塞对话框，要求填写 DeepSeek 官方 API 密钥，用户才能进入产品其余部分。Models 页已经提供同一条写入路径——首次运行设置卡片或普通的缺失密钥行——因此该弹窗只是重复这条路径，还把 `#root` 设为 inert，并强迫用户在保存密钥与关闭协调器本轮之间二选一。[共用弹窗产品引导](../feature/2026-08-13-shared-modal-product-onboarding.md)曾把该弹窗放在测试阶段声明之后；声明仍需发布，凭据接管则不必。

## 决策

`ui-settings-models` 不再向 `settings.onboarding` 注册 `deepseek-official` 步骤。版本化欢迎声明仍是唯一已发布的首次启动弹窗。缺失的官方密钥通过既有 `ProviderEditor` 在 Models 页填写；`credentials.set` 仍是唯一的 secret 写入。

仅凭据编辑模式、对应引导文案键以及 `onboardingReadiness` 随该步骤一并删除。Models 联接仍报告是否已有任意提供方可服务请求，该事实仍决定页面的首次运行设置卡片姿态。Host 的设置与凭据契约不变。

## 曾考虑的替代方案

**保留弹窗，只把「稍后配置」设为默认。** 不予采用：用户本来就能跳过的强制首启插页仍然是一次接管，而 Models 页已经持有这次写入。

**自动完成该步骤但不删除注册项。** 不予采用：一个总会完成的已挂载步骤对协调器是死代码，还会让不再使用的编辑器模式和文案键继续存活。

**在同一次改动中一并移除欢迎声明。** 不予采用：声明是带有独立确认字段的另一项产品表述；本决策只移除凭据接管。

## 后果

新 profile 会看到测试阶段声明，随后进入普通应用。API 密钥设置只存在于「设置 → 模型」。若要重新引入首次启动凭据提示，需要一份取代本注记的新产品决策。

## 测试

- `packages/client/ui-settings-models` 的单元覆盖钉住唯一的 `welcome-notice` 占位、不带引导投影的 `providerUsable`，以及不带仅凭据 props 的 `ProviderEditor`。
- 无密钥组装 Web 场景 `onboarding-deepseek-config` 与 `onboarding-usable-provider` 断言不会出现「添加一个 API Key 开始使用」弹窗，缺失的官方密钥从 Models 页写入。
