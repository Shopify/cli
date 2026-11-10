import {cacheRetrieve, PackageVersionKey} from './conf-store.js'
import {hashString} from '../../public/node/crypto.js'
import {satisfies, valid} from 'semver'

const cacheExpiryMs = 24 * 60 * 60 * 1000
// Prerun resolves the source. Postrun must not read npm configuration or start a lookup.
let currentRegistry: string | undefined

export async function resolveCLIRegistry(): Promise<string> {
  try {
    const {default: registryUrl} = await import('registry-url')
    const registry = new URL(registryUrl('@shopify'))
    registry.username = ''
    registry.password = ''
    registry.search = ''
    registry.hash = ''
    if (!registry.pathname.endsWith('/')) registry.pathname += '/'
    currentRegistry = registry.href
    return currentRegistry
  } catch (error) {
    currentRegistry = undefined
    throw error
  }
}

export function getCLIVersionCacheKey(registry: string, versionRange?: string): PackageVersionKey {
  return `npm-package-@shopify/cli${versionRange ? `@${versionRange}` : ''}:registry:${hashString(registry)}`
}

export function getCachedCLIVersion(versionRange?: string): string | undefined {
  if (!currentRegistry) return undefined
  const cached = cacheRetrieve(getCLIVersionCacheKey(currentRegistry, versionRange))
  if (
    cached &&
    valid(cached.value) &&
    (!versionRange || satisfies(cached.value, versionRange)) &&
    Date.now() - cached.timestamp < cacheExpiryMs
  ) {
    return cached.value
  }
  return undefined
}
