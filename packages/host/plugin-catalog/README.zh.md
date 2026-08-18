# `@deepseek-ai/dsh-host-plugin-catalog`

[English](README.md) | 中文

在 Host webserver 的 `/plugin-catalog/catalog.json` 上提供随安装内置的 StarPivot 插件目录。文档使用 marketplace 协议第 1 版，作为 `catalog.json` 与本包放在一起。发现页和其他目录客户端拉取这条精确路径；随安装内置的插件市场会按当前 webserver 端口解析它。

该路由受 effect 作用域约束：dispose（资源释放）插件的 fiber 会移除它，此后无人占据的路径回答 404（若回退席位已被占据，则走 SPA 回退）。

## 模型体验

无。该包只提供浏览器／Host JSON 目录；其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **清单是随发行版固定的 pin**：增删或改写一行是对本包 `catalog.json` 的源码编辑，而不是对 npm 的实时抓取。
