# Agent Note: 产品级默认重试预算与流空闲超时

Status: implemented

[English](2026-08-19-product-wide-llm-default-policy.md) | 中文

## 问题

提供方省略 `retryPolicy` 时，产品默认只再试两次；流空闲间隔则写在各适配器 schema 里，默认为五分钟。用户遇到超长思考流或偶发超时时，通用设置里没有对应控件。把这些旋钮做成新的树外重试插件，会重复 `dsh-llm-retry`，并与“策略跟提供方走”的既有决策冲突。只做在各适配器的模型卡片上，又会把进程级默认值藏进按路由编辑器。

## 决策

`@deepseek-ai/dsh-llm-default-policy` 持有一项进程级默认值：有限重试五次、关闭无限、以及五分钟流空闲间隔。Web「通用设置」行写入 `llm-default-policy` 设置分节。DeepSeek 与 pi-ai 适配器在省略 `retryPolicy` 或 `streamIdleTimeoutMs` 时，从 `ctx.llmDefaultPolicy.current()` 解析。无限对应 always 模式，否则 normal 模式使用 `maxRetries`。提供方一旦设置其中任一字段，就沿用该精确值。更改默认值会重新注册仍继承它的路由；进行中的请求仍沿用开始时捕获的服务策略。

`dsh-llm-retry` 仍然执行实际提供服务的策略。默认服务不监听 `agent/request-error`。

## 备选方案

**新的树外重试插件。** 否决，因为重试执行与持久 `llm/retry` 记录已属于 `dsh-llm-retry`，且策略必须跟随失败的提供方路由。

**在 `dsh-llm-retry` 上放一份全局 `retryPolicy`。** 否决，因为该执行器已拒绝该字段，以免提供方注册与恢复策略漂移。

**只把 `DEFAULT_MAX_RETRIES` 改成 5，不加设置行。** 否决，因为需求是用户可见的通用设置，而不是静默改默认值。

**只改各提供方的模型卡片，不做通用行。** 否决，因为需求是产品级默认值；按提供方覆盖仍留在适配器配置上。

## 后果

省略提供方策略的 Headless 与 Web 组合现在会重试五次。仍要两次预算的运营方应把 `llm-default-policy.maxRetries` 设为 2，或给提供方写自己的 `retryPolicy`。无限会重试每次模型请求失败，包括永久鉴权与配额错误，直到成功或取消。
