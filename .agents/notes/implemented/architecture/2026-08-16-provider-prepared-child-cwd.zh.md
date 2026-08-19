# Agent Note: Providers may prepare a durable child working directory

Status: implemented

[English](2026-08-16-provider-prepared-child-cwd.md) | 中文

## Problem

每个进程内子 agent 都继承父会话工作目录。提供方可以在创建前准备好隔离检出，但一次性驱动和 `ContinuableCreateSpec` 都无法把该目录写入会话 header。若在子创建所有者之外实现隔离，就要复制驱动和继续执行管理器，从而失去发布、取消、持久化和冷恢复保证。

## Decision

两个子创建所有者都接受一个受信任的已解析工作目录。`InProcessRunOptions.cwd` 覆盖一次性子 agent 的父目录继承。`ContinuableCreateSpec.cwd` 对持久化子 agent 的首次 Activation 做同样的事。`ContinuableStartSpec.cwd` 允许同进程调用方直接提供该目录，并覆盖提供方准备的值——已经按子 agent 传递 persona、工具过滤和 agent 选项的队长式编排插件就是这类调用方。所有路径都通过 `childSessionMeta` 传递该值，因此子 header 在 Agent 发布前就是完整的。

覆盖是可选的。现有 spawn 和 fork 提供方省略它，继续继承父目录。拥有隔离工作区的提供方在返回或调用驱动前解析并校验该目录。

可继续准备只在首次 Activation 运行。继续执行管理器把 `cwd` 持久化进子会话 header，冷恢复通过普通 Agent 恢复路径使用该 header，不再调用提供方。工作区创建、身份校验、保留和清理仍是提供方的事；subagent 包只把目录送进现有生命周期所有者。

这条接缝不创建 git worktree，不改变 AgentTeams 的 spawn 策略，也不授权文件系统访问。

## Alternatives considered

- **把进程内驱动和继续执行管理器复制进隔离插件**：否决，因为发布、取消、完全停稳 dispose、描述符顺序、持久化和冷恢复会有两套实现，彼此漂移。
- **全局改进程工作目录**：否决，因为并发子 agent 需要不同目录，进程级突变会与其他 Agent 和工具竞态。
- **只存提供方工作区 id，每次恢复再解析**：否决，因为会话 header 已经拥有持久化 cwd，冷恢复刻意避免调度提供方，额外查找会让恢复在构造 Agent 前依赖插件专用状态。
- **给 subagent 服务加 worktree 专用接口**：否决，因为 subagent 生命周期只需要已解析目录；Git 所有权和策略属于准备该目录的提供方。
- **同一改动里把每个 AgentTeams 成员绑到 worktree**：推迟。成员是持久化可继续子 agent，cwd 在 spawn 时冻结。审阅者和规划者应留在队长树；可写成员以后可以选用一棵树。自动 `git worktree add` 和合并仍是这条接缝的后续消费者。

## Consequences

- 隔离提供方复用与内置提供方相同的一次性与可继续生命周期实现。
- 即使父级后来改了 cwd，或准备该目录的提供方已不可用，持久化子 agent 也会在创建时记录的目录中恢复。
- 受信任的同进程提供方负责路径校验和资源所有权；这次改动不会把 cwd 变成沙箱，也不会授权访问。
- 聚焦的驱动和继续执行测试钉死显式覆盖、默认继承、持久化，以及不依赖提供方的冷恢复语义。

## Testing

- `packages/subagent/subagent-in-process-driver/tests/subagent-in-process-driver.spec.ts` 覆盖父目录继承和一次性显式覆盖。
- `packages/subagent/subagent/tests/continuation.spec.ts` 持久化提供方准备的可继续 cwd，优先使用调用方提供的 cwd，并在准备提供方注销后冷恢复。
