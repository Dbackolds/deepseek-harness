# @deepseek-ai/dsh-client-ui-settings-llm-policy

[English](README.md) | 中文

「通用设置」中的产品级模型请求重试预算与流空闲超时间隔行。Host schema 属于 `@deepseek-ai/dsh-llm-default-policy`；本包只把该分节绑定到 `settings.general.item`。

该行编辑三个字段：有限重试次数（默认 5）、映射到 always 恢复模式的「无限」开关，以及以秒显示的未完成读取空闲间隔（默认 300）。提供方一旦设置自己的 `retryPolicy` 或 `streamIdleTimeoutMs`，仍沿用该值。

## 模型体验

通过适配器在提供方省略这些字段时应用的重试预算与空闲间隔间接影响。

#### KV Cache 影响

更改该行只影响之后仍省略自身策略或空闲间隔的适配器注册。

## 已知限制与暂缓事项

- 该行写入一项进程级默认值；按提供方覆盖仍写在各适配器自己的配置上。
