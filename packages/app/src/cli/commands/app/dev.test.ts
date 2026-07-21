import Dev from './dev.js'
import {dev, type DevOptions} from '../../services/dev.js'
import {linkedAppContext} from '../../services/app-context.js'
import {storeContext} from '../../services/store-context.js'
import {getTunnelMode} from '../../services/dev/tunnel-mode.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/app-context.js')
vi.mock('../../services/store-context.js')
vi.mock('../../services/dev/tunnel-mode.js')
vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/metadata')

describe('app dev command', () => {
  let resolvedDevOptions: DevOptions | undefined

  beforeEach(() => {
    vi.mocked(dev).mockReset()
    vi.mocked(dev).mockImplementation(async (commandOptions) => {
      resolvedDevOptions = commandOptions
      return resolvedDevOptions.app
    })
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(storeContext).mockReset()
    vi.mocked(getTunnelMode).mockReset()
    vi.mocked(checkFolderIsValidApp).mockReset()
    vi.mocked(addPublicMetadata).mockReset()
    resolvedDevOptions = undefined
  })

  test('does not require --use-localhost when --install-mkcert is not passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const app = testAppLinked({directory: tmp})
      const appContextResult = {
        app,
        remoteApp: testOrganizationApp(),
        organization: testOrganization(),
        project: testProject(),
        activeConfig: {} as never,
        specifications: [],
        developerPlatformClient: testDeveloperPlatformClient(),
      } as Awaited<ReturnType<typeof linkedAppContext>>
      const store = testOrganizationStore({shopDomain: 'dev-store.myshopify.com'})

      vi.mocked(linkedAppContext).mockResolvedValue(appContextResult)
      vi.mocked(storeContext).mockResolvedValue(store)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)

      expect(getTunnelMode).toHaveBeenCalledWith({
        useLocalhost: false,
        tunnelUrl: undefined,
        localhostPort: undefined,
      })
      expect(dev).toHaveBeenCalledWith(expect.objectContaining({installMkcert: false, tunnel: {mode: 'auto'}}))
      expect(resolvedDevOptions).toEqual(expect.objectContaining({installMkcert: false, tunnel: {mode: 'auto'}}))
    })
  })

  test('requires --use-localhost when --install-mkcert is passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(Dev.run(['--path', tmp, '--install-mkcert'], import.meta.url)).rejects.toThrow()

      expect(dev).not.toHaveBeenCalled()
    })
  })
})
