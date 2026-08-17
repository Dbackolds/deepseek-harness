/** Registry package-name and version checks for marketplace install requests. */

const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/
const VERSION = /^(?:[0-9]+(?:\.[0-9A-Za-z-]+)*(?:[+.][0-9A-Za-z.-]+)*|[A-Za-z][0-9A-Za-z._-]*)$/

export function isRegistryPackageName(name: string): boolean {
  return PACKAGE_NAME.test(name)
    && !name.includes('..')
    && !name.startsWith('.')
    && !name.includes(':')
}

export function isInstallVersion(version: string): boolean {
  return VERSION.test(version) && !version.includes('/') && !version.includes(':')
}

export function installSpec(name: string, version: string | undefined): string {
  return version === undefined || version.length === 0 ? name : `${name}@${version}`
}
