import {checkForCLIVersions, getCachedCurrentMajorCLIVersion} from './cli-version-check.js'
import * as confStore from './conf-store.js'
import {CLI_KIT_VERSION} from '../../public/common/version.js'
import {inTemporaryDirectory} from '../../public/node/fs.js'
import {LocalStorage} from '../../public/node/local-storage.js'
import {checkForNewVersionInBackground} from '../../public/node/hooks/prerun.js'
import {versionToAutoUpgrade} from '../../public/node/upgrade.js'
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
const latestCacheKey = 'npm-package-@shopify/cli'
const currentMajorCacheKey = `${latestCacheKey}@${currentMajorRange}` as const

beforeEach(() => {
  vi.stubEnv('SHOPIFY_CLI_FORCE_AUTO_UPGRADE', undefined)
  vi.mocked(registryUrl).mockReturnValue('https://registry.npmjs.org/')
  vi.spyOn(confStore, 'getAutoUpgradeEnabled').mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function withCache(run: (storage: LocalStorage<confStore.ConfSchema>) => Promise<void>) {
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
