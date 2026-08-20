# Agent Note: 移除 user 消息的编辑存根

Status: implemented

[English](2026-07-31-drop-user-message-edit-stub.md) | 中文

## 问题

user 气泡的 IconActions 行在复制和分支旁边还有一个编辑按钮，但其背后什么都没有：该控件没有点击处理、没有 client 侧变更，也没有 host 侧重新发送已编辑消息的操作。用户找到它时，看到的是一个产品无法兑现的可供性。

## 决策

未绑定的编辑控件因没有 host 变更而被移除。同一会话改写随后在已定稿 user prompt 上恢复了有后端的编辑控件（[同一会话内改写 user prompt](../feature/2026-08-20-same-session-user-prompt-rewrite.md)）。公共 locale 的通用 `edit` 词条仍是共享词汇。

## 曾考虑的替代方案

**把按钮置灰并加提示。** 一个可见但无效的控件仍在宣告可以编辑，解释成本相同；直接移除才是诚实的状态。

**接到队列编辑器上。** 队列编辑的是尚未发送的消息。已定稿的 user 消息已经进入 transcript（文本记录）和模型上下文，复用该编辑器会让同一个动作悄悄变成另一件事。

## 后果

未绑定的编辑控件不得再出现。已定稿 prompt 的修正由 `session.rewrite` 和 user 气泡上的就地编辑器拥有。
