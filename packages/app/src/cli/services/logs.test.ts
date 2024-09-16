import {logs} from './logs.js'
import {subscribeToAppLogs, sourcesForApp} from './app-logs/utils.js'
import {ensureDevContext, storeFromFqdn} from './context.js'
import * as renderLogs from './app-logs/logs-command/ui.js'
import * as renderJsonLogs from './app-logs/logs-command/render-json-logs.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {
  buildVersionedAppSchema,
  testApp,
  testOrganizationApp,
  testOrganizationStore,
} from '../models/app/app.test-data.js'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, test, vi, expect} from 'vitest'
import {renderInfo} from '@shopify/cli-kit/node/ui'

vi.mock('../models/app/loader.js')
vi.mock('./context.js', async () => {
  const actualModule = await vi.importActual('./context.js')

  return {
    ...actualModule,
    ensureDevContext: vi.fn(),
    storeFromFqdn: vi.fn(),
  }
})
vi.mock('./app-logs/logs-command/ui.js')
vi.mock('./app-logs/logs-command/render-json-logs.js')
vi.mock('./app-logs/utils.js')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/ui')

describe('logs', () => {
  test('should call json handler when format is json', async () => {
    // Given
    const sources = ['extensions.source']
    await setupDevContext(sources)
    const spy = vi.spyOn(renderJsonLogs, 'renderJsonLogs')

    // When
    await logs({
      reset: false,
      format: 'json',
      directory: 'directory',
      apiKey: 'api-key',
      storeFqdns: ['store-fqdn'],
      sources,
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    expect(consoleLog).toHaveBeenCalledWith('{"message":"Waiting for app logs..."}')
    expect(spy).toHaveBeenCalled()
  })

  test('should call text handler when format is text', async () => {
    // Given
    const sources = ['extensions.source']
    await setupDevContext(sources)
    const spy = vi.spyOn(renderLogs, 'renderLogs')

    // When
    await logs({
      reset: false,
      format: 'text',
      apiKey: 'api-key',
      directory: 'directory',
      storeFqdns: ['store-fqdn'],
      sources,
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    expect(consoleLog).toHaveBeenCalledWith('Waiting for app logs...\n')
    expect(spy).toHaveBeenCalled()
  })

  test('should raise error when app has no valid sources', async () => {
    // Given
    await setupDevContext([])
    const spy = vi.spyOn(renderLogs, 'renderLogs')

    // When
    await expect(() => {
      return logs({
        reset: false,
        format: 'text',
        apiKey: 'api-key',
        directory: 'directory',
        storeFqdns: ['store-fqdn'],
        sources: ['extensions.source'],
        status: 'status',
        configName: 'config-name',
        userProvidedConfigName: 'user-provided-config-name',
      })
    }).rejects.toThrowError(
      new AbortError(
        'This app has no log sources. Learn more about app logs at https://shopify.dev/docs/api/shopify-cli/app/app-logs',
      ),
    )
  })

  test('should raise error when sources in filter do not match valid sources', async () => {
    // Given
    await setupDevContext(['realSource', 'anotherSource'])
    const spy = vi.spyOn(renderLogs, 'renderLogs')

    // When
    await expect(() => {
      return logs({
        reset: false,
        format: 'text',
        apiKey: 'api-key',
        directory: 'directory',
        storeFqdns: ['store-fqdn'],
        sources: ['extensions.realSource', 'extensions.invalidSource'],
        status: 'status',
        configName: 'config-name',
        userProvidedConfigName: 'user-provided-config-name',
      })
    }).rejects.toThrowError(
      new AbortError(
        'Invalid sources: extensions.invalidSource. Valid sources are: extensions.realSource, extensions.anotherSource',
      ),
    )
  })

  test('should load additional stores in JSON mode', async () => {
    // Given
    const sources = ['extensions.source']
    await setupDevContext(sources)
    const spy = vi.spyOn(renderJsonLogs, 'renderJsonLogs')

    vi.mocked(storeFromFqdn).mockResolvedValueOnce(testOrganizationStore({shopId: '2', shopDomain: 'other-fqdn'}))

    // When
    await logs({
      reset: false,
      format: 'json',
      directory: 'directory',
      apiKey: 'api-key',
      storeFqdns: ['store-fqdn', 'other-fqdn'],
      sources,
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    const expectedStoreMap = new Map()
    expectedStoreMap.set('1', 'store-fqdn')
    expectedStoreMap.set('2', 'other-fqdn')
    expect(consoleLog).toHaveBeenCalledWith('{"subscribedToStores":["store-fqdn","other-fqdn"]}')
    expect(consoleLog).toHaveBeenCalledWith('{"message":"Waiting for app logs..."}')
    expect(spy).toHaveBeenCalledWith({
      options: {
        developerPlatformClient: expect.anything(),
        variables: {shopIds: ['1', '2'], apiKey: expect.anything(), token: expect.anything()},
      },
      pollOptions: expect.anything(),
      storeNameById: expectedStoreMap,
    })
  })

  test('should load additional stores in TTY mode', async () => {
    // Given
    const sources = ['extensions.source']
    await setupDevContext(sources)
    const spy = vi.spyOn(renderLogs, 'renderLogs')

    vi.mocked(storeFromFqdn).mockResolvedValueOnce(testOrganizationStore({shopId: '2', shopDomain: 'other-fqdn'}))

    // When
    await logs({
      reset: false,
      format: 'text',
      directory: 'directory',
      apiKey: 'api-key',
      storeFqdns: ['store-fqdn', 'other-fqdn'],
      sources,
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    const expectedStoreMap = new Map()
    expectedStoreMap.set('1', 'store-fqdn')
    expectedStoreMap.set('2', 'other-fqdn')
    expect(consoleLog).toHaveBeenCalledWith('Waiting for app logs...\n')
    expect(spy).toHaveBeenCalledWith({
      options: {
        developerPlatformClient: expect.anything(),
        variables: {shopIds: ['1', '2'], apiKey: expect.anything(), token: expect.anything()},
      },
      pollOptions: expect.anything(),
      storeNameById: expectedStoreMap,
    })
  })

  test('should call ensureDevContext with customInfoBox flag and render custom info box', async () => {
    // Given
    const sources = ['extensions.source']
    const customInfoBox = true
    await setupDevContext(sources)
    vi.mocked(storeFromFqdn).mockResolvedValueOnce(testOrganizationStore({shopId: '2', shopDomain: 'other-fqdn'}))

    // When
    await logs({
      reset: false,
      format: 'text',
      directory: 'directory',
      apiKey: 'api-key',
      storeFqdns: ['store-fqdn', 'other-fqdn'],
      sources,
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    expect(ensureDevContext).toHaveBeenCalledWith({
      apiKey: 'api-key',
      configName: 'config-name',
      customInfoBox,
      developerPlatformClient: expect.anything(),
      directory: 'directory',
      format: 'text',
      status: 'status',
      reset: false,
      sources: ['extensions.source'],
      storeFqdn: 'store-fqdn',
      storeFqdns: ['store-fqdn', 'other-fqdn'],
      userProvidedConfigName: 'user-provided-config-name',
    })

    expect(renderInfo).toHaveBeenCalledWith({
      body: [
        {
          list: {
            items: [
              'Org:             org1',
              'App:             app1',
              'Dev store:       store-fqdn',
              'Dev store:       other-fqdn',
            ],
          },
        },
        '\n',
        'You can pass ',
        {
          command: '--reset',
        },
        ' to your command to reset your app configuration.',
      ],
      headline: 'Using these settings:',
    })
  })
})

async function setupDevContext(handles: string[]) {
  const {schema: configSchema} = await buildVersionedAppSchema()
  vi.mocked(loadAppConfiguration).mockResolvedValue({
    directory: '/app',
    configuration: {
      path: '/app/shopify.app.toml',
      scopes: 'read_products',
    },
    configSchema,
    specifications: [],
    remoteFlags: [],
  })

  vi.mocked(sourcesForApp).mockReturnValue(handles)

  vi.mocked(ensureDevContext).mockResolvedValue({
    localApp: testApp(),
    remoteApp: testOrganizationApp(),
    remoteAppUpdated: false,
    updateURLs: false,
    storeFqdn: 'store-fqdn',
    storeId: '1',
    organization: 'org1',
  })
  vi.mocked(subscribeToAppLogs).mockResolvedValue('jwt-token')
}
