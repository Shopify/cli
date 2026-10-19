import Dev from './dev.js'
import DevClean from './dev/clean.js'
import {devClean} from '../../services/dev-clean.js'
import {dev} from '../../services/dev.js'
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
import {
  acquireDevInstance,
  DEV_INSTANCE_ALREADY_RUNNING_CODE,
  readDevInstance,
} from '@shopify/cli-kit/node/dev-instance'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/dev-clean.js')
vi.mock('../../services/app-context.js')
vi.mock('../../services/store-context.js')
vi.mock('../../services/dev/tunnel-mode.js')
vi.mock('../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/metadata')

describe('app dev command', () => {
  beforeEach(() => {
    vi.mocked(dev).mockReset()
    vi.mocked(linkedAppContext).mockReset()
    vi.mocked(storeContext).mockReset()
    vi.mocked(getTunnelMode).mockReset()
    vi.mocked(checkFolderIsValidApp).mockReset()
    vi.mocked(addPublicMetadata).mockReset()
  })

  function mockAppAndStore(directory: string) {
    const appContextResult = {
      app: testAppLinked({directory}),
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
    vi.mocked(devClean).mockResolvedValue({
      status: 'success',
      app: {name: appContextResult.remoteApp.title, clientId: appContextResult.remoteApp.apiKey},
      storeHostname: store.shopDomain,
    })

    return {store}
  }

  test.each([
    ['app dev', Dev, dev],
    ['app dev clean', DevClean, devClean],
  ])('%s accepts --config together with --client-id', async (_name, command, service) => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await command.run(
        ['--path', tmp, '--store', store.shopDomain, '--config', 'prod', '--client-id', 'a-different-app'],
        import.meta.url,
      )

      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: 'a-different-app',
        forceRelink: false,
        userProvidedConfigName: 'prod',
      })
      expect(service).toHaveBeenCalled()
    })
  })

  test.each([
    ['app dev', Dev],
    ['app dev clean', DevClean],
  ])('%s still rejects --reset together with --config', async (_name, command) => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(command.run(['--path', tmp, '--config', 'prod', '--reset'], import.meta.url)).rejects.toThrow()

      expect(linkedAppContext).not.toHaveBeenCalled()
      expect(dev).not.toHaveBeenCalled()
      expect(devClean).not.toHaveBeenCalled()
    })
  })

  test('does not require --use-localhost when --install-mkcert is not passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)

      expect(getTunnelMode).toHaveBeenCalledWith({
        useLocalhost: false,
        tunnelUrl: undefined,
        localhostPort: undefined,
      })
      expect(storeContext).toHaveBeenCalledWith(expect.objectContaining({storeCreationMode: 'selection-option'}))
      expect(dev).toHaveBeenCalledWith(
        expect.objectContaining({installMkcert: undefined, unsafeValidation: false, tunnel: {mode: 'auto'}}),
      )
    })
  })

  test('passes --unsafe-validation to dev', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})

      await Dev.run(['--path', tmp, '--store', store.shopDomain, '--unsafe-validation'], import.meta.url)

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({unsafeValidation: true}))
    })
  })

  // `generateCertificate()` only shows the "generate it now?" prompt when `installMkcert` is nullish, so an
  // omitted --install-mkcert must stay undefined rather than being collapsed into an explicit `false`.
  test('leaves installMkcert undefined with --use-localhost so the certificate prompt is reached', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'use-localhost', requestedPort: 3458, actualPort: 3458})

      await Dev.run(['--path', tmp, '--store', store.shopDomain, '--use-localhost'], import.meta.url)

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({installMkcert: undefined}))
    })
  })

  test('sets installMkcert to true when --install-mkcert is passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'use-localhost', requestedPort: 3458, actualPort: 3458})

      await Dev.run(
        ['--path', tmp, '--store', store.shopDomain, '--use-localhost', '--install-mkcert'],
        import.meta.url,
      )

      expect(dev).toHaveBeenCalledWith(expect.objectContaining({installMkcert: true}))
    })
  })

  test('requires --use-localhost when --install-mkcert is passed', async () => {
    await inTemporaryDirectory(async (tmp) => {
      await expect(Dev.run(['--path', tmp, '--install-mkcert'], import.meta.url)).rejects.toThrow()

      expect(dev).not.toHaveBeenCalled()
      expect(devClean).not.toHaveBeenCalled()
    })
  })
  test('records the running instance while dev runs and releases it afterwards', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      const identity = {command: 'app dev', directory: tmp, key: 'shopify.app.toml'}
      let instanceWhileRunning: Awaited<ReturnType<typeof readDevInstance>>
      vi.mocked(dev).mockImplementation(async () => {
        instanceWhileRunning = await readDevInstance(identity)
      })

      await Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)

      expect(instanceWhileRunning).toMatchObject({command: 'app dev', key: 'shopify.app.toml', pid: process.pid})
      expect(dev).toHaveBeenCalledWith(expect.objectContaining({devInstance: expect.any(Object)}))
      await expect(readDevInstance(identity)).resolves.toBeUndefined()
    })
  })

  test('refuses to start when app dev is already running for the same configuration', async () => {
    await inTemporaryDirectory(async (tmp) => {
      const {store} = mockAppAndStore(tmp)
      vi.mocked(getTunnelMode).mockResolvedValue({mode: 'auto'})
      const running = await acquireDevInstance({command: 'app dev', directory: tmp, key: 'shopify.app.toml'})

      // The command's error handler renders the AbortError and exits.
      await expect(Dev.run(['--path', tmp, '--store', store.shopDomain], import.meta.url)).rejects.toThrow()
      await expect(
        acquireDevInstance({command: 'app dev', directory: tmp, key: 'shopify.app.toml'}),
      ).rejects.toMatchObject({code: DEV_INSTANCE_ALREADY_RUNNING_CODE, details: {instance: running.info}})

      expect(storeContext).not.toHaveBeenCalled()
      expect(dev).not.toHaveBeenCalled()
      await running.release()
    })
  })
})
