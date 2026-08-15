/** Locale bundles for the system-prompt settings section. */

/** Locale keys this page renders. */
export type SystemPromptsKey =
  | 'nav' | 'title' | 'intro' | 'builtInGroup' | 'libraryGroup' | 'modelsGroup'
  | 'loading' | 'error' | 'retry' | 'unavailable' | 'readOnly'
  | 'emptyBuiltIns' | 'emptyLibrary' | 'emptyModels' | 'emptySection'
  | 'addPrompt' | 'edit' | 'editBuiltIn' | 'resetBuiltIn' | 'overridden' | 'delete'
  | 'builtInFailed'
  | 'promptName' | 'promptNamePlaceholder' | 'promptText' | 'promptTextPlaceholder'
  | 'save' | 'saving' | 'cancel' | 'close'
  | 'deleteTitle' | 'deleteDescription' | 'deleteConfirm' | 'deleting'
  | 'nameRequired' | 'textRequired'
  | 'selectedCount' | 'override' | 'overrideHint' | 'appendHint'
  | 'moveUp' | 'moveDown' | 'removeFromModel' | 'addToModel'
  | 'noPromptsToAdd' | 'catalogFailed'

/** English copy. */
export const en: Record<SystemPromptsKey, string> = {
  nav: 'System prompts',
  title: 'System prompts',
  intro:
    'Edit the prompts this harness already registers, write reusable extras, then choose which extras each model uses and in which order. '
    + 'Override replaces the assembled prompt for that model; otherwise the selected extras are appended.',
  builtInGroup: 'Shipped prompts',
  libraryGroup: 'Library',
  modelsGroup: 'Per-model assembly',
  loading: 'Loading system prompts…',
  error: 'Could not load system prompts.',
  retry: 'Retry',
  unavailable: 'This deployment does not expose system-prompt settings.',
  readOnly: 'This deployment stores settings read-only.',
  emptyBuiltIns: 'This deployment has not registered any system-prompt sections.',
  emptyLibrary: 'No extra system prompts yet. Create one to assemble it onto a model.',
  emptyModels: 'No models are available to assemble.',
  emptySection: '(empty)',
  addPrompt: 'New system prompt',
  edit: 'Edit',
  editBuiltIn: 'Edit shipped prompt',
  resetBuiltIn: 'Restore original',
  overridden: 'Edited',
  delete: 'Delete',
  promptName: 'Name',
  promptNamePlaceholder: 'Shown in this list',
  promptText: 'Prompt',
  promptTextPlaceholder: 'Text the model reads as a system-prompt section',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  deleteTitle: 'Delete this system prompt?',
  deleteDescription: 'Every model that selected it loses that selection. Running sessions pick up the change on their next assembled step.',
  deleteConfirm: 'Delete',
  deleting: 'Deleting…',
  nameRequired: 'Give the prompt a name.',
  textRequired: 'Write the prompt text.',
  selectedCount: '{count} selected',
  override: 'Override assembled prompt',
  overrideHint: 'The selected texts replace the assembled system prompt for this model.',
  appendHint: 'The selected texts are appended after the assembled system prompt.',
  moveUp: 'Move up',
  moveDown: 'Move down',
  removeFromModel: 'Remove from this model',
  addToModel: 'Add to this model',
  noPromptsToAdd: 'Every prompt is already selected.',
  catalogFailed: 'Could not load the model catalog. The library is still editable.',
  builtInFailed: 'Could not load the shipped prompts. The library is still editable.',
}

/** Simplified Chinese copy. */
export const zh: Record<SystemPromptsKey, string> = {
  nav: '系统提示词',
  title: '系统提示词',
  intro: '编辑本 harness 已注册的提示词，再编写可复用的额外提示词，并为每个模型选择要用哪些、按什么顺序。覆盖会替换该模型已组装的提示词；否则选中的额外文本追加在后面。',
  builtInGroup: '自带提示词',
  libraryGroup: '提示词库',
  modelsGroup: '按模型组装',
  loading: '正在加载系统提示词…',
  error: '无法加载系统提示词。',
  retry: '重试',
  unavailable: '此部署未开放系统提示词设置。',
  readOnly: '本部署的设置为只读。',
  emptyBuiltIns: '此部署尚未注册任何系统提示词段。',
  emptyLibrary: '还没有额外的系统提示词。先创建一条，再组装到模型上。',
  emptyModels: '当前没有可组装的模型。',
  emptySection: '（空）',
  addPrompt: '新建系统提示词',
  edit: '编辑',
  editBuiltIn: '编辑自带提示词',
  resetBuiltIn: '恢复原文',
  overridden: '已编辑',
  delete: '删除',
  promptName: '名称',
  promptNamePlaceholder: '显示在此列表中',
  promptText: '提示词',
  promptTextPlaceholder: '模型作为系统提示词段读到的文本',
  save: '保存',
  saving: '保存中…',
  cancel: '取消',
  close: '关闭',
  deleteTitle: '删除该系统提示词？',
  deleteDescription: '选中它的模型会失去该选择。运行中的会话在下一次组装步骤生效。',
  deleteConfirm: '删除',
  deleting: '正在删除…',
  nameRequired: '请填写名称。',
  textRequired: '请填写提示词文本。',
  selectedCount: '已选 {count} 条',
  override: '覆盖已组装提示词',
  overrideHint: '选中的文本会替换该模型已组装的系统提示词。',
  appendHint: '选中的文本会追加在已组装的系统提示词之后。',
  moveUp: '上移',
  moveDown: '下移',
  removeFromModel: '从该模型移除',
  addToModel: '添加到该模型',
  noPromptsToAdd: '全部提示词都已选中。',
  catalogFailed: '无法加载模型目录。提示词库仍可编辑。',
  builtInFailed: '无法加载自带提示词。提示词库仍可编辑。',
}
