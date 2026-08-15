/** Locale bundles for the subagent settings section. */

/** Locale keys this page renders. */
export type SubagentsKey =
  | 'nav' | 'title' | 'intro' | 'libraryGroup'
  | 'loading' | 'error' | 'retry' | 'unavailable' | 'readOnly'
  | 'emptyLibrary' | 'emptySection'
  | 'addDefinition' | 'edit' | 'delete'
  | 'definitionName' | 'definitionNamePlaceholder'
  | 'definitionDescription' | 'definitionDescriptionPlaceholder'
  | 'persona' | 'personaPlaceholder'
  | 'allow' | 'allowPlaceholder' | 'deny' | 'denyPlaceholder' | 'filterHint'
  | 'save' | 'saving' | 'cancel' | 'close'
  | 'deleteTitle' | 'deleteDescription' | 'deleteConfirm' | 'deleting'
  | 'nameRequired' | 'personaRequired'

/** English copy. */
export const en: Record<SubagentsKey, string> = {
  nav: 'Subagents',
  title: 'Subagents',
  intro:
    'Create reusable child definitions. The model can pick one by id when it calls subagent; '
    + 'that definition supplies the child persona and optional tool filter.',
  libraryGroup: 'Library',
  loading: 'Loading subagents…',
  error: 'Could not load subagents.',
  retry: 'Retry',
  unavailable: 'This deployment does not expose subagent settings.',
  readOnly: 'This deployment stores settings read-only.',
  emptyLibrary: 'No subagent definitions yet. Create one for the model to choose.',
  emptySection: '(empty)',
  addDefinition: 'New subagent',
  edit: 'Edit',
  delete: 'Delete',
  definitionName: 'Name',
  definitionNamePlaceholder: 'Shown in this list',
  definitionDescription: 'Description',
  definitionDescriptionPlaceholder: 'Shown to the model when it chooses a definition',
  persona: 'Persona',
  personaPlaceholder: 'Role instructions that replace the deployment persona for this child',
  allow: 'Allow tools',
  allowPlaceholder: 'Comma-separated global tool names to keep',
  deny: 'Deny tools',
  denyPlaceholder: 'Comma-separated global tool names to hide',
  filterHint: 'Leave both empty to inherit every global tool. Allow keeps only the named tools; deny removes the named tools.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  deleteTitle: 'Delete this subagent?',
  deleteDescription: 'The model can no longer choose this definition. Running children keep the composition they started with.',
  deleteConfirm: 'Delete',
  deleting: 'Deleting…',
  nameRequired: 'Give the subagent a name.',
  personaRequired: 'Write the persona text.',
}

/** Simplified Chinese copy. */
export const zh: Record<SubagentsKey, string> = {
  nav: '子代理',
  title: '子代理',
  intro: '创建可复用的子代理定义。模型调用 subagent 时可按 id 选用一条；该定义提供子代理的 persona 与可选工具过滤。',
  libraryGroup: '定义库',
  loading: '正在加载子代理…',
  error: '无法加载子代理。',
  retry: '重试',
  unavailable: '此部署未开放子代理设置。',
  readOnly: '本部署的设置为只读。',
  emptyLibrary: '还没有子代理定义。先创建一条，供模型选用。',
  emptySection: '（空）',
  addDefinition: '新建子代理',
  edit: '编辑',
  delete: '删除',
  definitionName: '名称',
  definitionNamePlaceholder: '显示在此列表中',
  definitionDescription: '说明',
  definitionDescriptionPlaceholder: '模型选择定义时看到的说明',
  persona: 'Persona',
  personaPlaceholder: '替换该子代理部署 persona 的角色说明',
  allow: '允许的工具',
  allowPlaceholder: '逗号分隔的全局工具名，仅保留这些',
  deny: '拒绝的工具',
  denyPlaceholder: '逗号分隔的全局工具名，从子代理中隐藏',
  filterHint: '两项都留空则继承全部全局工具。允许列表只保留点名的工具；拒绝列表移除点名的工具。',
  save: '保存',
  saving: '保存中…',
  cancel: '取消',
  close: '关闭',
  deleteTitle: '删除该子代理？',
  deleteDescription: '模型将无法再选用该定义。已在运行的子代理保持它启动时的组合。',
  deleteConfirm: '删除',
  deleting: '正在删除…',
  nameRequired: '请填写名称。',
  personaRequired: '请填写 persona 文本。',
}
