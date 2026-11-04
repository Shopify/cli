import {dev, blockIfMigrationIncomplete} from './dev.js'
import {setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {renderDev} from './dev/ui.js'
import {fetchAppRemoteConfiguration} from './app/select-app.js'
import {DevSessionStatusManager} from './dev/processes/dev-session/dev-session-status-manager.js'
import {DevSessionLogger} from './dev/processes/dev-session/dev-session-logger.js'
import {installAppDependencies} from './dependencies.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {acquireDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {Writable} from 'stream'

vi.mock('./local-storage.js')
vi.mock('./dev/fetch.js')
vi.mock('./dev/processes/setup-dev-processes.js')
vi.mock('./dev/ui.js')
vi.mock('./app/select-app.js')
vi.mock('./dependencies.js')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('../utilities/mkcert.js')
vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')

describe('dev', () => {
  beforeEach(() => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(false)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
  })

  test('logs store domain metadata when launching dev', async () => {
    const store = testOrganizationStore({shopDomain: 'dev-store.myshopify.com'})
    const app = testAppLinked()
    let publicMetadata: Record<string, unknown> | undefined
    let sensitiveMetadata: Record<string, unknown> | undefined

    vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue({name: 'Remote app', application_url: '', embedded: true})
    vi.mocked(getAvailableTCPPort).mockResolvedValue(3456)
    vi.mocked(checkPortAvailability).mockResolvedValue(true)
    vi.mocked(setupDevProcesses).mockResolvedValue({
      processes: [],
      previewUrl: 'https://dev-store.myshopify.com/admin/apps/api-key',
      graphiqlUrl: undefined,
      devSessionStatusManager: {} as any,
    })
    vi.mocked(renderDev).mockResolvedValue(undefined)

    const addPublicMetadata = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async (getMetadata) => {
      publicMetadata = getMetadata() as Record<string, unknown>
    })
    const addSensitiveMetadata = vi.spyOn(metadata, 'addSensitiveMetadata').mockImplementation(async (getMetadata) => {
      sensitiveMetadata = getMetadata() as Record<string, unknown>
    })

    await dev({
      app,
      project: testProject({usesWorkspaces: true}),
      remoteApp: testOrganizationApp({apiKey: 'api-key'}),
      organization: testOrganization(),
      specifications: [],
      developerPlatformClient: testDeveloperPlatformClient(),
      store,
      directory: app.directory,
      update: false,
      commandConfig: {} as any,
      skipDependenciesInstallation: true,
      tunnel: {mode: 'custom', url: 'https://localhost:3456'},
    })

    expect(publicMetadata).toEqual(
      expect.objectContaining({
        cmd_dev_tunnel_type: 'localhost',
        cmd_dev_urls_updated: false,
        store_fqdn_hash: hashString(store.shopDomain),
        store_domain: store.shopDomain,
        cmd_app_dependency_installation_skipped: true,
      }),
    )
    expect(sensitiveMetadata).toEqual(
      expect.objectContaining({
        store_fqdn: store.shopDomain,
        cmd_dev_tunnel_custom: undefined,
      }),
    )
    expect(reportAnalyticsEvent).toHaveBeenCalledWith({config: {}, exitMode: 'ok'})
    expect(renderSingleTask).not.toHaveBeenCalled()

    addPublicMetadata.mockRestore()
    addSensitiveMetadata.mockRestore()
  })

  test('renders the interactive layout before installing dependencies', async () => {
    vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
    const app = testAppLinked()
    const store = testOrganizationStore({shopDomain: 'dev-store.myshopify.com'})
    let loadingIndicatorStarted = false
    let loadingIndicatorFinished = false
    let dependencyInstallationStarted = () => {}
    const dependencyInstallationStart = new Promise<void>((resolve) => {
      dependencyInstallationStarted = resolve
    })
    let finishDependencyInstallation = () => {}
    const dependencyInstallationFinished = new Promise<void>((resolve) => {
      finishDependencyInstallation = resolve
    })

    vi.mocked(fetchAppRemoteConfiguration).mockImplementation(async () => {
      expect(loadingIndicatorStarted).toBe(true)
      return {name: 'Remote app', application_url: '', embedded: true}
    })
    vi.mocked(getAvailableTCPPort).mockResolvedValue(3456)
    vi.mocked(checkPortAvailability).mockResolvedValue(true)
    vi.mocked(renderSingleTask).mockImplementation(async ({task}) => {
      loadingIndicatorStarted = true
      const result = await task(() => {})
      loadingIndicatorFinished = true
      return result
    })
    vi.mocked(installAppDependencies).mockImplementation(async () => {
      dependencyInstallationStarted()
      await dependencyInstallationFinished
    })
    vi.mocked(setupDevProcesses).mockResolvedValue({
      processes: [],
      previewUrl: 'https://dev-store.myshopify.com/admin/apps/api-key',
      graphiqlUrl: undefined,
      devSessionStatusManager: {} as any,
    })
    vi.mocked(renderDev).mockImplementation(async ({processes, abortController}) => {
      expect(loadingIndicatorFinished).toBe(true)
      await processes[0]?.action(process.stdout, process.stderr, abortController.signal)
    })

    const devPromise = dev({
      app,
      project: testProject({usesWorkspaces: false}),
      remoteApp: testOrganizationApp({apiKey: 'api-key'}),
      organization: testOrganization(),
      specifications: [],
      developerPlatformClient: testDeveloperPlatformClient(),
      store,
      directory: app.directory,
      update: false,
      commandConfig: {} as any,
      skipDependenciesInstallation: false,
      tunnel: {mode: 'custom', url: 'https://localhost:3456'},
    })

    await dependencyInstallationStart
    expect(renderSingleTask).toHaveBeenCalledWith(
      expect.objectContaining({title: expect.objectContaining({value: 'Starting dev preview'})}),
    )
    expect(renderSingleTask).toHaveBeenCalledOnce()
    expect(renderDev).toHaveBeenCalledOnce()
    expect(setupDevProcesses).not.toHaveBeenCalled()

    finishDependencyInstallation()
    await devPromise

    expect(setupDevProcesses).toHaveBeenCalledOnce()
  })
})

describe('dev with a dev instance', () => {
  test.each([
    {interactive: false, loseLock: false},
    {interactive: false, loseLock: true},
    {interactive: true, loseLock: false},
    {interactive: true, loseLock: true},
  ])(
    'captures output and session URLs (interactive=$interactive, loseLock=$loseLock)',
    async ({interactive, loseLock}) => {
      vi.mocked(terminalSupportsPrompting).mockReturnValue(interactive)
      vi.mocked(renderSingleTask).mockImplementation(async ({task}) => task(() => {}))
      await inTemporaryDirectory(async (tmp) => {
        const store = testOrganizationStore({shopDomain: 'dev-store.myshopify.com'})
        const app = testAppLinked({directory: tmp})
        const manager = new DevSessionStatusManager({
          isReady: false,
          statusMessage: {type: 'loading', message: 'Preparing dev preview'},
        })
        const devInstance = await acquireDevInstance({command: 'app dev', directory: tmp})
        const ownership = new AbortController()
        const previewUrl = 'https://dev-store.myshopify.com/admin/apps/api-key'
        const graphiqlUrl = 'http://localhost:3456/graphiql'
        let infoWhileRunning: unknown

        vi.mocked(fetchAppRemoteConfiguration).mockResolvedValue({
          name: 'Remote app',
          application_url: '',
          embedded: true,
        })
        vi.mocked(getAvailableTCPPort).mockResolvedValue(3456)
        vi.mocked(checkPortAvailability).mockResolvedValue(true)
        vi.mocked(setupDevProcesses).mockResolvedValue({
          processes: [
            {
              type: 'web',
              prefix: 'web',
              function: async ({stdout, stderr}: {stdout: Writable; stderr: Writable}) => {
                stdout.write('Server listening on 3000\n')
                stderr.write('Deprecation warning\n')
                useConcurrentOutputContext({outputPrefix: 'discount'}, () => {
                  stdout.write('Building function discount...')
                  stdout.write('Building GraphQL types...\n')
                })
                await new DevSessionLogger(stdout).info('Update accepted')
              },
              options: {},
            } as any,
          ],
          previewUrl,
          graphiqlUrl,
          devSessionStatusManager: manager,
        })
        const terminal = new Writable({write: (_chunk, _encoding, callback) => callback()})
        vi.mocked(renderDev).mockImplementation(async ({processes, abortController, devSessionStatusManager}) => {
          await Promise.all(processes.map((process) => process.action(terminal, terminal, abortController.signal)))
          devSessionStatusManager.updateStatus({previewURL: previewUrl})
          devSessionStatusManager.setMessage('READY')
          devSessionStatusManager.setMessage('CHANGE_DETECTED')
          devSessionStatusManager.updateStatus({isReady: true})
          devSessionStatusManager.setMessage('BUILD_ERROR', ['discount: Invalid input'])
          devSessionStatusManager.updateStatus({graphiqlURL: graphiqlUrl})
          await vi.waitFor(async () => {
            infoWhileRunning = JSON.parse(await readFile(devInstance.paths.infoFile))
            expect(infoWhileRunning).toHaveProperty('details.preview.errors', ['discount: Invalid input'])
          })
          if (loseLock) {
            ownership.abort(new Error('Lock lost'))
            expect(abortController.signal.aborted).toBe(true)
          }
        })

        const running = dev({
          app,
          project: testProject({usesWorkspaces: true}),
          remoteApp: testOrganizationApp({apiKey: 'api-key'}),
          organization: testOrganization(),
          specifications: [],
          developerPlatformClient: testDeveloperPlatformClient(),
          store,
          directory: app.directory,
          update: false,
          commandConfig: {} as any,
          skipDependenciesInstallation: true,
          tunnel: {mode: 'custom', url: 'https://localhost:3456'},
          devInstance: {...devInstance, abortSignal: ownership.signal},
        })
        if (loseLock) {
          await expect(running).rejects.toThrow('Lock lost')
        } else {
          await running
        }
        await devInstance.release()

        expect(infoWhileRunning).toMatchObject({
          status: 'running',
          details: {
            storeFqdn: 'dev-store.myshopify.com',
            previewUrl,
            preview: {state: 'error', errors: ['discount: Invalid input']},
          },
        })
        const entries = (await readFile(devInstance.paths.logFile))
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line))
        entries.forEach((entry) => expect(entry).not.toHaveProperty('stream'))
        expect(entries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({source: 'app dev', message: `Preview URL: ${previewUrl}`}),
            expect.objectContaining({source: 'app dev', message: `GraphiQL URL (Admin API): ${graphiqlUrl}`}),
            expect.objectContaining({source: 'web', message: 'Server listening on 3000'}),
            expect.objectContaining({source: 'web', message: 'Deprecation warning'}),
            expect.objectContaining({source: 'discount', message: 'Building function discount...'}),
            expect.objectContaining({source: 'discount', message: 'Building GraphQL types...'}),
            expect.objectContaining({source: 'app-preview', message: 'Update accepted'}),
          ]),
        )
        expect(
          entries
            .filter(({source}) => source === 'app dev')
            .filter(({message}) => !message.startsWith('Preview URL:') && !message.startsWith('GraphiQL URL'))
            .map(({level, message}) => ({level, message})),
        ).toEqual([
          {level: 'info', message: 'Preparing dev preview'},
          {level: 'info', message: 'Ready, watching for changes in your app'},
          {level: 'info', message: 'Change detected, updating dev preview'},
          {level: 'error', message: 'Build error. Please review your code and try again'},
        ])
      })
    },
  )
})

describe('blockIfMigrationIncomplete', () => {
  const baseConfig = () => ({
    localApp: testAppLinked({}),
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
  })

  test('does nothing when all remote extensions have ids (migrated)', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      async appExtensionRegistrations() {
        return {
          app: {
            extensionRegistrations: [
              {id: '1', uuid: 'u1', title: 'Ext 1', type: 'theme'},
              {id: '2', uuid: 'u2', title: 'Ext 2', type: 'web_pixel_extension'},
            ],
            configurationRegistrations: [],
            dashboardManagedExtensionRegistrations: [],
          },
        } as any
      },
    })

    const devConfig = {
      ...baseConfig(),
      developerPlatformClient,
    } as any

    await expect(blockIfMigrationIncomplete(devConfig)).resolves.toBeUndefined()
  })

  test('does nothing remote extensions dont have uids but are webhook subscriptions', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      async appExtensionRegistrations() {
        return {
          app: {
            extensionRegistrations: [
              {id: '', uuid: 'u1', title: 'Ext 1', type: 'webhook_subscription'},
              {id: '2', uuid: 'u2', title: 'Ext 2', type: 'web_pixel_extension'},
            ],
            configurationRegistrations: [],
            dashboardManagedExtensionRegistrations: [],
          },
        } as any
      },
    })

    const devConfig = {
      ...baseConfig(),
      developerPlatformClient,
    } as any

    await expect(blockIfMigrationIncomplete(devConfig)).resolves.toBeUndefined()
  })

  test('throws AbortError when some remote extensions are missing ids (not migrated)', async () => {
    const developerPlatformClient = testDeveloperPlatformClient({
      async appExtensionRegistrations() {
        return {
          app: {
            extensionRegistrations: [
              {id: '', uuid: 'u1', title: 'Legacy Ext 1', type: 'theme'},
              {uuid: 'u2', title: 'Legacy Ext 2', type: 'web_pixel_extension'},
            ],
            configurationRegistrations: [],
            dashboardManagedExtensionRegistrations: [],
          },
        } as any
      },
    })

    const devConfig = {
      ...baseConfig(),
      developerPlatformClient,
    } as any

    await expect(blockIfMigrationIncomplete(devConfig)).rejects.toThrow(/need to be assigned uid identifiers/)
  })
})
