import {dev, blockIfMigrationIncomplete} from './dev.js'
import {setupDevProcesses} from './dev/processes/setup-dev-processes.js'
import {renderDev} from './dev/ui.js'
import {fetchAppRemoteConfiguration} from './app/select-app.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../models/app/app.test-data.js'
import metadata from '../metadata.js'
import {describe, expect, test, vi} from 'vitest'
import {hashString} from '@shopify/cli-kit/node/crypto'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {checkPortAvailability, getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {createSyncDiagnosticChannel} from '@shopify/diagnostics'

vi.mock('./dev/fetch.js')
vi.mock('./dev/processes/setup-dev-processes.js')
vi.mock('./dev/ui.js')
vi.mock('./app/select-app.js')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/tcp')
vi.mock('../utilities/mkcert.js')

describe('dev', () => {
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
      format: 'text',
      events: createSyncDiagnosticChannel(),
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

    addPublicMetadata.mockRestore()
    addSensitiveMetadata.mockRestore()
  })
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
