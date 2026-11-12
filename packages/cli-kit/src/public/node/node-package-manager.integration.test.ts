import {checkForNewVersion} from './node-package-manager.js'
import {inTemporaryDirectory} from './fs.js'
import {LocalStorage} from './local-storage.js'
import * as versionCache from '../../private/node/cli-version-cache.js'
import * as confStore from '../../private/node/conf-store.js'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {afterEach, expect, test, vi} from 'vitest'

const firstRegistry = 'https://first-registry.example.com/'
const secondRegistry = 'https://second-registry.example.com/'

function metadata(latest: string, currentMajor: string) {
  return {
    name: '@shopify/cli',
    'dist-tags': {latest},
    versions: Object.fromEntries([latest, currentMajor].map((version) => [version, {name: '@shopify/cli', version}])),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test.each([undefined, '5.x'])(
  'pins the real registry request to the captured source for range %s',
  async (versionRange) => {
    const requests = {first: 0, second: 0}
    const server = setupServer(
      http.get(`${firstRegistry}*`, () => {
        requests.first += 1
        return HttpResponse.json(metadata('6.0.0', '5.2.0'))
      }),
      http.get(`${secondRegistry}*`, () => {
        requests.second += 1
        return HttpResponse.json(metadata('7.0.0', '5.3.0'))
      }),
    )
    server.listen({onUnhandledRequest: 'error'})
    try {
      await inTemporaryDirectory(async (directory) => {
        const storage = new LocalStorage<confStore.ConfSchema>({cwd: directory})
        const repopulate = confStore.cacheRetrieveOrRepopulate
        const repopulateSpy = vi
          .spyOn(confStore, 'cacheRetrieveOrRepopulate')
          .mockImplementation((key, populate, timeout) => repopulate(key, populate, timeout, storage))
        const resolveRegistry = versionCache.resolveCLIRegistry
        // Change actual npm configuration after capture, before latest-version/package-json reads it.
        const resolveSpy = vi.spyOn(versionCache, 'resolveCLIRegistry').mockImplementation(async () => {
          const registry = await resolveRegistry()
          vi.stubEnv('npm_@shopify:registry', secondRegistry)
          return registry
        })
        vi.stubEnv('npm_@shopify:registry', firstRegistry)
        try {
          const options = {cacheExpiryInHours: 24, ...(versionRange ? {versionRange} : {})}
          const expectedVersion = versionRange ? '5.2.0' : '6.0.0'
          await expect(checkForNewVersion('@shopify/cli', '5.0.0', options)).resolves.toBe(expectedVersion)
          expect(resolveSpy).toHaveBeenCalledTimes(1)
          expect(requests).toEqual({first: 1, second: 0})
          expect(
            storage.get('cache')?.[versionCache.getPublicCLIVersionCacheKey(firstRegistry, versionRange)]?.value,
          ).toBe(expectedVersion)
          expect(
            storage.get('cache')?.[versionCache.getPublicCLIVersionCacheKey(secondRegistry, versionRange)],
          ).toBeUndefined()

          vi.stubEnv('npm_@shopify:registry', firstRegistry)
          await expect(checkForNewVersion('@shopify/cli', '5.0.0', options)).resolves.toBe(expectedVersion)
          expect(requests).toEqual({first: 1, second: 0})
        } finally {
          resolveSpy.mockRestore()
          repopulateSpy.mockRestore()
        }
      })
    } finally {
      server.close()
    }
  },
)
