/** Package id shown on catalog cards and in the details dialog. */
export function catalogPackageLabel(name: string, version: string): string {
  return version.length > 0 ? `${name}@${version}` : name
}

/** Hover text for an installed card: package name, then spec when present. */
export function installedHoverLabel(packageName: string, spec: string): string {
  return spec.length > 0 ? `${packageName}\n${spec}` : packageName
}
