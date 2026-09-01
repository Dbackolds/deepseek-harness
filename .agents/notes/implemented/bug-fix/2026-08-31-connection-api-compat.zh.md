# Agent Note: 为 Client 插件恢复 connection.api

Status: implemented

[English](2026-08-31-connection-api-compat.md) | 中文

## 问题

Typert Remote 拆分去掉了 `connection.api`。仍按更早一元面编译的 Client 插件会调用 `connection.api.llm.providers`、`llm.models`、`settings.describe` 与 `settings.update`，并解开 `response.result`。槽位消失后，这些插件一挂载设置页就抛 `Cannot read properties of undefined (reading 'llm')` / `'settings'`。`@dsh-plugin/dsh-auxiliary` 是现存消费方：其「辅助模型」页读这个面，无法配置视觉或压缩路由。

当前产品表面已经使用 `ctx.remote.llm` 与 `ctx.remote.settings`。缺的只是这些插件仍在编译期依赖的历史信封。

## 决策

产品 API 仍是 `ctx.remote`。API Remotes 挂载所选 namespace 之后，在活动的 Connection handle 上安装兼容的 `connection.api`：

- `llm.providers` 把 `listProviders` 与 `listConfigurableProviders` 拼成历史上的提供方行（`provider`、`displayName`、`settingsNs`、`active`）。
- `llm.models` 从脱敏后的 `llm-pi-ai` 设置文档与活动路由构造提供方分组。没有公布模型的分组会被丢掉。
- `settings.describe` / `settings.update` 包装当前 Remote 方法，并返回 `{ rpcId, result }`。

该槽在 `ConnectionHandle` 上是可选的。Connection 不填充它；组合卸载时 Remotes 会还原先前的值。新表面必须调用 `ctx.remote`。

`$mount` 把每个 namespace 装在堂兄弟 fiber 上。Remotes 客户端 fiber 只 inject 了 `remote`，因此这里读 `ctx.remote.llm` / `ctx.remote.settings` 会抛 `cannot get property "remote.<namespace>" without inject`。挂载完成后再开一个声明了这两个名字的子 fiber，由它读取 handle 并安装兼容面。

## 考虑过的方案

- **只改 `$DSH_HOME/profiles` 里已装插件。** 这次修补挺不过 `dsh plugin add` 或升级，其他仍走旧面的插件也会继续坏。
- **把适配器放进 Connection。** Connection 不得依赖它并不拥有的 Remote namespace。挂载 `llm` 与 `settings` 的组合才是唯一能装完整面的地方。
- **在 `ctx.remote` 旁边再做一套正式一元客户端。** 这会复制 Remote 映射，并诱使新代码继续使用旧信封。

## 后果

仍调用这四个 `connection.api` 方法的插件，在 Host 重建并刷新页面后可以工作。该面只覆盖这一历史子集。目录分组来自设置文档，而不是 Host `listModels` Remote，因为该方法不在 Client Remote 映射上。

## 测试

`packages/api/remotes/tests/connection-api.client.spec.ts` 覆盖提供方拼接、目录分组、Remote 失败转发，以及 Connection 槽的安装与还原。`packages/api/remotes/tests/client-apply.client.spec.ts` 覆盖加载器真实使用的堂兄弟 fiber inject 路径。
