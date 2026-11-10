import {cacheRetrieve, cacheStore} from './conf-store.js'
import {getCachedCLIVersion, getCLIVersionCacheKey, resolveCLIRegistry} from './cli-version-cache.js'
import {CLI_KIT_VERSION} from '../../public/common/version.js'
import {outputDebug} from '../../public/node/output.js'
import {maxSatisfying, SemVer, valid} from 'semver'

const failureBackoffMs = 5 * 60 * 1000
const requestTimeoutMs = 3000
const packageName = '@shopify/cli'
const currentMajorRange = `${new SemVer(CLI_KIT_VERSION).major}.x`

interface CLIVersions {
  latest?: string
  currentMajor?: string
}

interface PackageMetadata {
  'dist-tags': {latest?: string}
  versions: Record<string, {version: string; deprecated?: string}>
}

const pendingLookups = new Map<string, Promise<CLIVersions>>()

export function getCachedCurrentMajorCLIVersion(): string | undefined {
  return getCachedCLIVersion(currentMajorRange)
}

export async function checkForCLIVersions({includeCurrentMajor = true} = {}): Promise<CLIVersions> {
  try {
    const registry = await resolveCLIRegistry()
    const lookupKey = getCLIVersionCacheKey(registry, currentMajorRange)
    const pendingLookup = pendingLookups.get(lookupKey)
    if (pendingLookup) return pendingLookup

    const latest = getCachedCLIVersion(undefined, registry)
    const currentMajor = getCachedCLIVersion(currentMajorRange, registry)
    if (latest && (!includeCurrentMajor || currentMajor)) return {latest, currentMajor}

    const failure = cacheRetrieve(`${lookupKey}-lookup-failure`)
    if (failure && Date.now() - failure.timestamp < failureBackoffMs) return {}

    const lookup = fetchAndCacheVersions(registry)
      .catch(() => ({}))
      .finally(() => {
        pendingLookups.delete(lookupKey)
      })
    pendingLookups.set(lookupKey, lookup)
    return lookup
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    outputDebug('Skipping the CLI version lookup after a registry or cache failure.')
    return {}
  }
}

async function fetchAndCacheVersions(registry: string): Promise<CLIVersions> {
  const latestCacheKey = getCLIVersionCacheKey(registry)
  const currentMajorCacheKey = getCLIVersionCacheKey(registry, currentMajorRange)
  const failureCacheKey = `${currentMajorCacheKey}-lookup-failure` as const
  try {
    const [{fetch}, {default: registryAuthToken}] = await Promise.all([
      import('../../public/node/http.js'),
      import('registry-auth-token'),
    ])
    const url = new URL(encodeURIComponent(packageName).replace(/^%40/, '@'), registry)
    const auth = registryAuthToken(registry, {recursive: true})
    const headers: Record<string, string> = {
      accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
    }
    if (auth) headers.authorization = `${auth.type} ${auth.token}`

    const response = await fetch(
      url.href,
      // Registry credentials must never be copied to a redirect destination.
      {headers, redirect: 'error'},
      {
        useNetworkLevelRetry: false,
        useAbortSignal: true,
        timeoutMs: requestTimeoutMs,
      },
    )
    if (!response.ok) throw new Error('The npm registry request failed.')
    const metadata = (await response.json()) as PackageMetadata
    const latest = metadata['dist-tags'].latest
    const eligibleVersions = Object.keys(metadata.versions).filter((version) => !metadata.versions[version]?.deprecated)
    const currentMajor = maxSatisfying(eligibleVersions, currentMajorRange)
    if (!latest || !valid(latest) || !metadata.versions[latest] || !currentMajor) {
      throw new Error('The npm registry did not return stable CLI versions.')
    }
    cacheStore(latestCacheKey, latest)
    cacheStore(currentMajorCacheKey, currentMajor)
    return {latest, currentMajor}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    outputDebug('Skipping the CLI version lookup after a registry or cache failure.')
    cacheStore(failureCacheKey, '')
    return {}
  }
}
