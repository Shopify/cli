import {checkForCLIVersions, getCachedCurrentMajorCLIVersion} from './cli-version-check.js'
import {getCLIVersionCacheKey, resolveCLIRegistry} from './cli-version-cache.js'
import * as confStore from './conf-store.js'
import {CLI_KIT_VERSION} from '../../public/common/version.js'
import {inTemporaryDirectory} from '../../public/node/fs.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {checkForNewVersionInBackground} from '../../public/node/hooks/prerun.js'
import {versionToAutoUpgrade} from '../../public/node/upgrade.js'
import {checkForCachedNewVersion} from '../../public/node/node-package-manager.js'
import * as httpClient from '../../public/node/http.js'
import {isCI} from '../../public/node/system.js'
import {isPreReleaseVersion} from '../../public/node/version.js'
import {SemVer} from 'semver'
import registryUrl from 'registry-url'
import registryAuthToken from 'registry-auth-token'
import {http, HttpResponse, HttpHandler} from 'msw'
import {setupServer} from 'msw/node'
import {afterEach, beforeEach, expect, test, vi} from 'vitest'
import {createServer} from 'node:http'

vi.mock('registry-url')
vi.mock('registry-auth-token')
vi.mock('../../public/node/system.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../public/node/system.js')>()),
  isCI: vi.fn(() => false),
}))
vi.mock('../../public/node/version.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../public/node/version.js')>()),
  isPreReleaseVersion: vi.fn(() => false),
}))

const currentMajorRange = `${new SemVer(CLI_KIT_VERSION).major}.x`
const currentMajorVersion = new SemVer(CLI_KIT_VERSION).inc('patch').version
const nextMajorVersion = new SemVer(CLI_KIT_VERSION).inc('major').version
const prereleaseVersion = `${new SemVer(CLI_KIT_VERSION).inc('minor').version}-rc.1`
const metadata = {
  'dist-tags': {latest: nextMajorVersion},
  versions: Object.fromEntries(
    [CLI_KIT_VERSION, currentMajorVersion, prereleaseVersion, nextMajorVersion].map((version) => [version, {version}]),
  ),
}
const latestCacheKey = getCLIVersionCacheKey('https://registry.npmjs.org/')
const currentMajorCacheKey = getCLIVersionCacheKey('https://registry.npmjs.org/', currentMajorRange)

beforeEach(() => {
  vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', undefined)
  vi.mocked(registryUrl).mockReturnValue('https://registry.npmjs.org/')
  vi.spyOn(confStore, 'getAutoUpgradeEnabled').mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function withCache(run: (storage: LocalStorage<confStore.ConfSchema>) => Promise<void>) {
  await resolveCLIRegistry()
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
    const retrieve = confStore.cacheRetrieve
    const store = confStore.cacheStore
    const retrieveSpy = vi.spyOn(confStore, 'cacheRetrieve').mockImplementation((key) => retrieve(key, storage))
    const storeSpy = vi.spyOn(confStore, 'cacheStore').mockImplementation((key, value) => store(key, value, storage))
    try {
      await run(storage)
    } finally {
      retrieveSpy.mockRestore()
      storeSpy.mockRestore()
    }
  })
}

async function withRegistry(handler: HttpHandler, run: (storage: LocalStorage<confStore.ConfSchema>) => Promise<void>) {
  const server = setupServer(handler)
  server.listen({onUnhandledRequest: 'error'})
  try {
    await withCache(run)
  } finally {
    server.close()
  }
}

test.each(['missing', 'expired'])(
  'postrun skips the %s cache without waiting for the prerun lookup',
  async (cacheState) => {
    let requests = 0
    let releaseRequest!: () => void
    const requestCanFinish = new Promise<void>((resolve) => {
      releaseRequest = resolve
    })
    await withRegistry(
      http.get('https://registry.npmjs.org/*', async () => {
        requests += 1
        await requestCanFinish
        return HttpResponse.json(metadata)
      }),
      async (storage) => {
        try {
          if (cacheState === 'expired') {
            confStore.cacheStore(currentMajorCacheKey, currentMajorVersion)
            const cache = storage.get('cache')!
            cache[currentMajorCacheKey]!.timestamp -= 24 * 60 * 60 * 1000 + 1
            storage.set('cache', cache)
          }
          await checkForNewVersionInBackground()
          await vi.waitFor(() => expect(requests).toBe(1))
          expect(versionToAutoUpgrade()).toBeUndefined()
          releaseRequest()

          await checkForCLIVersions()
          expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
          expect(requests).toBe(1)
          expect(storage.get('cache')?.[latestCacheKey]?.value).toBe(nextMajorVersion)
          expect(storage.get('cache')?.[currentMajorCacheKey]?.value).toBe(currentMajorVersion)
        } finally {
          releaseRequest()
          await checkForCLIVersions()
        }
      },
    )
  },
)

test('reuses both caches for 24 hours and refreshes them with one request after expiry', async () => {
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return HttpResponse.json(metadata)
    }),
    async (storage) => {
      await expect(checkForCLIVersions()).resolves.toEqual({
        latest: nextMajorVersion,
        currentMajor: currentMajorVersion,
      })
      const populatedAt = storage.get('cache')![currentMajorCacheKey]!.timestamp
      const now = vi.spyOn(Date, 'now').mockReturnValue(populatedAt + 23 * 60 * 60 * 1000)
      await checkForNewVersionInBackground()
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
      expect(requests).toBe(1)

      now.mockReturnValue(populatedAt + 24 * 60 * 60 * 1000 + 1)
      await checkForNewVersionInBackground()
      expect(versionToAutoUpgrade()).toBeUndefined()
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
      expect(requests).toBe(2)
    },
  )
})

test('excludes a deprecated higher stable release after latest is moved back', async () => {
  const deprecatedVersion = new SemVer(CLI_KIT_VERSION).inc('minor').version
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () =>
      HttpResponse.json({
        'dist-tags': {latest: currentMajorVersion},
        versions: {
          [currentMajorVersion]: {version: currentMajorVersion},
          [deprecatedVersion]: {version: deprecatedVersion, deprecated: 'Broken release; do not install'},
        },
      }),
    ),
    async () => {
      await expect(checkForCLIVersions()).resolves.toEqual({
        latest: currentMajorVersion,
        currentMajor: currentMajorVersion,
      })
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
    },
  )
})

test('caches a successful lookup even when no current-major update is available', async () => {
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return HttpResponse.json({
        'dist-tags': {latest: CLI_KIT_VERSION},
        versions: {[CLI_KIT_VERSION]: {version: CLI_KIT_VERSION}},
      })
    }),
    async () => {
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBeUndefined()
      await checkForNewVersionInBackground()
      expect(versionToAutoUpgrade()).toBeUndefined()
      expect(requests).toBe(1)
    },
  )
})

test('backs off failed lookups for five minutes without discarding cached versions', async () => {
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return requests === 1 ? new HttpResponse(null, {status: 503}) : HttpResponse.json(metadata)
    }),
    async (storage) => {
      confStore.cacheStore(latestCacheKey, CLI_KIT_VERSION)
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBeUndefined()
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBeUndefined()
      expect(requests).toBe(1)
      expect(storage.get('cache')?.[latestCacheKey]?.value).toBe(CLI_KIT_VERSION)

      const failedAt = storage.get('cache')![`${currentMajorCacheKey}-lookup-failure`]!.timestamp
      vi.spyOn(Date, 'now').mockReturnValue(failedAt + 5 * 60 * 1000 + 1)
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
      expect(requests).toBe(2)
    },
  )
})

test('registry switches isolate fresh latest and current-major caches while the new lookup is pending', async () => {
  let secondRegistryRequests = 0
  let releaseRequest!: () => void
  const requestCanFinish = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  const server = setupServer(
    http.get('https://registry.npmjs.org/*', () => HttpResponse.json(metadata)),
    http.get('https://mirror.example.com/*', async () => {
      secondRegistryRequests += 1
      await requestCanFinish
      return HttpResponse.json({
        'dist-tags': {latest: CLI_KIT_VERSION},
        versions: {[CLI_KIT_VERSION]: {version: CLI_KIT_VERSION}},
      })
    }),
  )
  server.listen({onUnhandledRequest: 'error'})
  try {
    await withCache(async () => {
      await checkForCLIVersions()
      vi.mocked(registryUrl).mockReturnValue('https://mirror.example.com/')
      const lookup = checkForCLIVersions()
      try {
        await vi.waitFor(() => expect(secondRegistryRequests).toBe(1))
        vi.mocked(registryUrl).mockClear()
        expect(versionToAutoUpgrade()).toBeUndefined()
        expect(checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)).toBeUndefined()
        expect(registryUrl).not.toHaveBeenCalled()
      } finally {
        releaseRequest()
        await lookup
      }
      expect(getCachedCurrentMajorCLIVersion()).toBe(CLI_KIT_VERSION)
      expect(checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)).toBeUndefined()
    })
  } finally {
    releaseRequest()
    server.close()
  }
})

test('a registry failure does not suppress a lookup from another registry', async () => {
  const server = setupServer(
    http.get('https://registry.npmjs.org/*', () => new HttpResponse(null, {status: 503})),
    http.get('https://mirror.example.com/*', () => HttpResponse.json(metadata)),
  )
  server.listen({onUnhandledRequest: 'error'})
  try {
    await withCache(async () => {
      await expect(checkForCLIVersions()).resolves.toEqual({})
      vi.mocked(registryUrl).mockReturnValue('https://mirror.example.com/')
      await expect(checkForCLIVersions()).resolves.toEqual({
        latest: nextMajorVersion,
        currentMajor: currentMajorVersion,
      })
    })
  } finally {
    server.close()
  }
})

test('in-flight lookups are shared only within the same registry and late results retain their source', async () => {
  let requests = 0
  let releaseRequest!: () => void
  const requestCanFinish = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  const server = setupServer(
    http.get('https://registry.npmjs.org/*', async () => {
      requests += 1
      await requestCanFinish
      return HttpResponse.json(metadata)
    }),
    http.get('https://mirror.example.com/*', () =>
      HttpResponse.json({
        'dist-tags': {latest: CLI_KIT_VERSION},
        versions: {[CLI_KIT_VERSION]: {version: CLI_KIT_VERSION}},
      }),
    ),
  )
  server.listen({onUnhandledRequest: 'error'})
  try {
    await withCache(async () => {
      const firstLookup = checkForCLIVersions()
      const sharedLookup = checkForCLIVersions()
      try {
        await vi.waitFor(() => expect(requests).toBe(1))
        vi.mocked(registryUrl).mockReturnValue('https://mirror.example.com/')
        await expect(checkForCLIVersions()).resolves.toEqual({latest: CLI_KIT_VERSION, currentMajor: CLI_KIT_VERSION})
      } finally {
        releaseRequest()
        await Promise.all([firstLookup, sharedLookup])
      }
      expect(requests).toBe(1)
      expect(getCachedCurrentMajorCLIVersion()).toBe(CLI_KIT_VERSION)
      expect(checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)).toBeUndefined()
    })
  } finally {
    releaseRequest()
    server.close()
  }
})

test('normalizes registry identity without including URL credentials, query, or fragment in cache keys', async () => {
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return HttpResponse.json(metadata)
    }),
    async (storage) => {
      vi.mocked(registryUrl).mockReturnValue(
        'https://synthetic-user:synthetic-password@REGISTRY.NPMJS.ORG:443/?synthetic-query#synthetic-fragment',
      )
      await checkForCLIVersions()
      const keys = Object.keys(storage.get('cache')!)
      expect(keys).toEqual(expect.arrayContaining([latestCacheKey, currentMajorCacheKey]))
      expect(keys.join(' ')).not.toContain('synthetic')
      vi.mocked(registryUrl).mockReturnValue('https://registry.npmjs.org')
      await checkForCLIVersions()
      expect(requests).toBe(1)
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
    },
  )
})

test('registry paths are distinct cache sources', async () => {
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return HttpResponse.json(metadata)
    }),
    async () => {
      await checkForCLIVersions()
      vi.mocked(registryUrl).mockReturnValue('https://registry.npmjs.org/mirror/')
      await checkForCLIVersions()
      expect(requests).toBe(2)
    },
  )
})

test('registry ports and major ranges have distinct cache keys', async () => {
  vi.mocked(registryUrl).mockReturnValue('https://registry.npmjs.org:8443/')
  const registry = await resolveCLIRegistry()
  expect(getCLIVersionCacheKey(registry)).not.toBe(latestCacheKey)
  expect(getCLIVersionCacheKey(registry, '5.x')).not.toBe(getCLIVersionCacheKey(registry, '6.x'))
})

test('ignores legacy unscoped caches and rejects reads when the registry cannot be resolved', async () => {
  await withCache(async () => {
    confStore.cacheStore('npm-package-@shopify/cli', nextMajorVersion)
    confStore.cacheStore(`npm-package-@shopify/cli@${currentMajorRange}`, currentMajorVersion)
    expect(versionToAutoUpgrade()).toBeUndefined()
    expect(checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)).toBeUndefined()

    confStore.cacheStore(latestCacheKey, nextMajorVersion)
    confStore.cacheStore(currentMajorCacheKey, currentMajorVersion)
    expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
    vi.mocked(registryUrl).mockImplementation(() => {
      throw new Error('Invalid registry configuration')
    })
    await expect(checkForCLIVersions()).resolves.toEqual({})
    vi.mocked(registryUrl).mockClear()
    expect(versionToAutoUpgrade()).toBeUndefined()
    expect(checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)).toBeUndefined()
    expect(registryUrl).not.toHaveBeenCalled()
  })
})

test('uses the configured scoped registry and its authentication', async () => {
  vi.mocked(registryUrl).mockReturnValue('https://npm.example.com/scoped/')
  vi.mocked(registryAuthToken).mockReturnValue({type: 'Bearer', token: 'test-token'})
  let authorization: string | null = null
  await withRegistry(
    http.get('https://npm.example.com/scoped/*', ({request}) => {
      authorization = request.headers.get('authorization')
      return HttpResponse.json(metadata)
    }),
    async () => {
      await expect(checkForCLIVersions()).resolves.toEqual({
        latest: nextMajorVersion,
        currentMajor: currentMajorVersion,
      })
      expect(registryUrl).toHaveBeenCalledWith('@shopify')
      expect(registryAuthToken).toHaveBeenCalledWith('https://npm.example.com/scoped/', {recursive: true})
      expect(authorization).toBe('Bearer test-token')
    },
  )
})

test.each([
  ['cross-port', 'https://registry.npmjs.org:8443/'],
  ['subdomain', 'https://mirror.registry.npmjs.org/'],
  ['unrelated-host', 'https://other.example.com/'],
])('rejects authenticated %s redirects without sending credentials to the destination', async (_kind, destination) => {
  const token = 'synthetic-redirect-test-token'
  vi.mocked(registryAuthToken).mockReturnValue({type: 'Bearer', token})
  let destinationRequests = 0
  const server = setupServer(
    http.get('https://registry.npmjs.org/*', ({request}) => {
      expect(request.headers.get('authorization')).toBe(`Bearer ${token}`)
      return new HttpResponse(null, {status: 302, headers: {location: destination}})
    }),
    http.get(`${destination}*`, () => {
      destinationRequests += 1
      return HttpResponse.json(metadata)
    }),
  )
  server.listen({onUnhandledRequest: 'error'})
  try {
    await withCache(async () => {
      await expect(checkForCLIVersions()).resolves.toEqual({})
      expect(destinationRequests).toBe(0)
      expect(versionToAutoUpgrade()).toBeUndefined()
    })
  } finally {
    server.close()
  }
})

test('does not refresh a missing major cache when auto-upgrade is disabled and latest is cached', async () => {
  vi.mocked(confStore.getAutoUpgradeEnabled).mockReturnValue(false)
  const fetch = vi.spyOn(httpClient, 'fetch')
  await withCache(async () => {
    confStore.cacheStore(latestCacheKey, nextMajorVersion)
    await checkForNewVersionInBackground()
    expect(versionToAutoUpgrade()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})

test('reads a fresh current-major version even when latest is not cached', async () => {
  const fetch = vi.spyOn(httpClient, 'fetch')
  await withCache(async () => {
    confStore.cacheStore(currentMajorCacheKey, currentMajorVersion)
    expect(getCachedCurrentMajorCLIVersion()).toBe(currentMajorVersion)
    expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
    expect(fetch).not.toHaveBeenCalled()
  })
})

test('a forced upgrade skips a missing current-major cache without using latest or fetching', async () => {
  vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', '1')
  const fetch = vi.spyOn(httpClient, 'fetch')
  await withCache(async () => {
    confStore.cacheStore(latestCacheKey, nextMajorVersion)
    expect(getCachedCurrentMajorCLIVersion()).toBeUndefined()
    expect(versionToAutoUpgrade()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})

test.each([24 * 60 * 60 * 1000 - 1, 24 * 60 * 60 * 1000, 24 * 60 * 60 * 1000 + 1])(
  'expires current-major cache-only reads at 24 hours, age=%i ms',
  async (ageMs) => {
    const fetch = vi.spyOn(httpClient, 'fetch')
    await withCache(async (storage) => {
      confStore.cacheStore(currentMajorCacheKey, currentMajorVersion)
      const timestamp = storage.get('cache')![currentMajorCacheKey]!.timestamp
      vi.spyOn(Date, 'now').mockReturnValue(timestamp + ageMs)
      const expectedVersion = ageMs < 24 * 60 * 60 * 1000 ? currentMajorVersion : undefined
      expect(getCachedCurrentMajorCLIVersion()).toBe(expectedVersion)
      expect(versionToAutoUpgrade()).toBe(expectedVersion)
      expect(fetch).not.toHaveBeenCalled()
    })
  },
)

test.each(['invalid-version', nextMajorVersion, prereleaseVersion])(
  'skips an invalid, wrong-major, or prerelease cached version: %s',
  async (version) => {
    const fetch = vi.spyOn(httpClient, 'fetch')
    await withCache(async () => {
      confStore.cacheStore(currentMajorCacheKey, version)
      expect(getCachedCurrentMajorCLIVersion()).toBeUndefined()
      expect(versionToAutoUpgrade()).toBeUndefined()
      expect(fetch).not.toHaveBeenCalled()
    })
  },
)

test.each(['CI', 'prerelease'])('skips background and automatic lookups for %s', async (gate) => {
  vi.mocked(isCI).mockReturnValue(gate === 'CI')
  vi.mocked(isPreReleaseVersion).mockReturnValue(gate === 'prerelease')
  const fetch = vi.spyOn(httpClient, 'fetch')
  await withCache(async () => {
    await checkForNewVersionInBackground()
    expect(versionToAutoUpgrade()).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})

test('a forced lookup runs in prerun even when normal update checks are disabled', async () => {
  vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', '1')
  vi.mocked(isCI).mockReturnValue(true)
  vi.mocked(isPreReleaseVersion).mockReturnValue(true)
  vi.mocked(confStore.getAutoUpgradeEnabled).mockReturnValue(false)
  let requests = 0
  await withRegistry(
    http.get('https://registry.npmjs.org/*', () => {
      requests += 1
      return HttpResponse.json(metadata)
    }),
    async () => {
      await checkForNewVersionInBackground()
      await checkForCLIVersions()
      expect(versionToAutoUpgrade()).toBe(currentMajorVersion)
      expect(requests).toBe(1)
    },
  )
})

test('cancels a stalled response body after three seconds', async () => {
  const fetch = vi.spyOn(httpClient, 'fetch')
  let connectionClosed!: () => void
  const closed = new Promise<void>((resolve) => {
    connectionClosed = resolve
  })
  const server = createServer((_request, response) => {
    response.writeHead(200, {'content-type': 'application/json'})
    response.write('{')
    response.on('close', connectionClosed)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected an HTTP server port.')
  vi.mocked(registryUrl).mockReturnValue(`http://127.0.0.1:${address.port}/`)
  try {
    await withCache(async () => {
      await expect(checkForCLIVersions()).resolves.toEqual({})
      await closed
      expect(fetch).toHaveBeenCalledWith(`http://127.0.0.1:${address.port}/@shopify%2Fcli`, expect.anything(), {
        useNetworkLevelRetry: false,
        useAbortSignal: true,
        timeoutMs: 3000,
      })
    })
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
})
