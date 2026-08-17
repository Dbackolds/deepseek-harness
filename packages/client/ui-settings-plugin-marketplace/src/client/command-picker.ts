/** Popup rows for `/reload` and `/update` plugin-name completion. */

export interface CommandReloadTarget {
  readonly id: string
  readonly moduleName: string
}

export interface CommandUpdateTarget {
  readonly name: string
}

export interface CommandTargets {
  readonly reload: readonly CommandReloadTarget[]
  readonly update: readonly CommandUpdateTarget[]
}

export interface CommandPickOption {
  readonly id: string
  readonly label: string
  readonly detail?: string
}

export function reloadPickOptions(
  targets: readonly CommandReloadTarget[],
  allLabel: string,
  allDetail: string,
): readonly CommandPickOption[] {
  const rows: CommandPickOption[] = [{ id: '', label: allLabel, detail: allDetail }]
  for (const target of targets) {
    rows.push({
      id: target.id,
      label: target.id,
      ...(target.moduleName.length > 0 && target.moduleName !== target.id
        ? { detail: target.moduleName }
        : {}),
    })
  }
  return rows
}

export function updatePickOptions(
  targets: readonly CommandUpdateTarget[],
  allLabel: string,
  allDetail: string,
): readonly CommandPickOption[] {
  return [
    { id: '', label: allLabel, detail: allDetail },
    ...targets.map(target => ({ id: target.name, label: target.name })),
  ]
}

export function commandLine(name: string, plugin: string): string {
  return plugin.length === 0 ? `/${name}` : `/${name} ${plugin}`
}
