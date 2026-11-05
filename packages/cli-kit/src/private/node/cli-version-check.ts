import {cacheRetrieve, cacheStore, PackageVersionKey} from './conf-store.js'
import {CLI_KIT_VERSION} from '../../public/common/version.js'
import {outputDebug} from '../../public/node/output.js'
import {maxSatisfying, SemVer, valid, satisfies} from 'semver'

const cacheExpiryMs = 24 * 60 * 60 * 1000
const failureBackoffMs = 5 * 60 * 1000
const requestTimeoutMs = 3000
const packageName = '@shopify/cli'
const currentMajorRange = `${new SemVer(CLI_KIT_VERSION).major}.x`
const latestCacheKey: PackageVersionKey = `npm-package-${packageName}`
const currentMajorCacheKey: PackageVersionKey = `${latestCacheKey}@${currentMajorRange}`
const failureCacheKey: PackageVersionKey = `${currentMajorCacheKey}-lookup-failure`

interface CLIVersions {
  latest?: string
  currentMajor?: string
}

interface PackageMetadata {
  'dist-tags': {latest?: string}
  versions: Record<string, {version: string}>
}

let pendingLookup: Promise<CLIVersions> | undefined

export async function checkForCLIVersions({includeCurrentMajor = true} = {}): Promise<CLIVersions> {
  if (pendingLookup) return pendingLookup

  const latest = cacheRetrieve(latestCacheKey)
  const currentMajor = cacheRetrieve(currentMajorCacheKey)
  const now = Date.now()
  const latestIsFresh = latest && valid(latest.value) && now - latest.timestamp < cacheExpiryMs
  const currentMajorIsFresh =
    currentMajor && satisfies(currentMajor.value, currentMajorRange) && now - currentMajor.timestamp < cacheExpiryMs
  if (latestIsFresh && (!includeCurrentMajor || currentMajorIsFresh)) {
    return {latest: latest.value, currentMajor: currentMajor?.value}
  }

  const failure = cacheRetrieve(failureCacheKey)
  if (failure && now - failure.timestamp < failureBackoffMs) return {}

  pendingLookup = fetchAndCacheVersions()
    .catch(() => ({}))
    .finally(() => {
      pendingLookup = undefined
    })
  return pendingLookup
}

async function fetchAndCacheVersions(): Promise<CLIVersions> {
  try {
    const [{fetch}, {default: registryUrl}, {default: registryAuthToken}] = await Promise.all([
      import('../../public/node/http.js'),
      import('registry-url'),
      import('registry-auth-token'),
    ])
    const registry = registryUrl('@shopify')
    const url = new URL(encodeURIComponent(packageName).replace(/^%40/, '@'), registry)
    const auth = registryAuthToken(registry, {recursive: true})
    const headers: Record<string, string> = {
      accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
    }
    if (auth) headers.authorization = `${auth.type} ${auth.token}`

    const response = await fetch(
      url.href,
      {headers},
      {
        useNetworkLevelRetry: false,
        useAbortSignal: true,
        timeoutMs: requestTimeoutMs,
      },
    )
    if (!response.ok) throw new Error('The npm registry request failed.')
    const metadata = (await response.json()) as PackageMetadata
    const latest = metadata['dist-tags'].latest
    const currentMajor = maxSatisfying(Object.keys(metadata.versions), currentMajorRange)
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
