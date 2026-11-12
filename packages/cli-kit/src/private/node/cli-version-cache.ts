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

export function getPublicCLIVersionCacheKey(registry: string, versionRange?: string): PackageVersionKey {
  const latestCacheKey = getCLIVersionCacheKey(registry)
  // Generic range results are not vetted for deprecation and must not feed auto-upgrades.
  return versionRange ? `${latestCacheKey}:range:${versionRange}` : latestCacheKey
}

export function getCachedCLIVersion(versionRange?: string, registry = currentRegistry): string | undefined {
  if (!registry) return undefined
  const cached = cacheRetrieve(getCLIVersionCacheKey(registry, versionRange))
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
