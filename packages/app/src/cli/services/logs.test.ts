import {logs} from './logs.js'
import {subscribeToAppLogs} from './app-logs/utils.js'
import {ensureDevContext} from './context.js'
import * as renderLogs from './app-logs/logs-command/ui.js'
import * as renderJsonLogs from './app-logs/logs-command/render-json-logs.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {buildVersionedAppSchema, testApp, testOrganizationApp} from '../models/app/app.test-data.js'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {describe, test, vi, expect} from 'vitest'

vi.mock('../models/app/loader.js')
vi.mock('./context.js')
vi.mock('./app-logs/logs-command/ui.js')
vi.mock('./app-logs/logs-command/render-json-logs.js')
vi.mock('./app-logs/utils.js')
vi.mock('@shopify/cli-kit/node/output')

describe('logs', () => {
  test('should call json handler when format is json', async () => {
    // Given
    await setupDevContext()
    const spy = vi.spyOn(renderJsonLogs, 'renderJsonLogs')

    // When
    await logs({
      reset: false,
      format: 'json',
      directory: 'directory',
      apiKey: 'api-key',
      storeFqdn: 'store-fqdn',
      source: 'source',
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
    await setupDevContext()
    const spy = vi.spyOn(renderLogs, 'renderLogs')

    // When
    await logs({
      reset: false,
      format: 'text',
      apiKey: 'api-key',
      directory: 'directory',
      storeFqdn: 'store-fqdn',
      source: 'source',
      status: 'status',
      configName: 'config-name',
      userProvidedConfigName: 'user-provided-config-name',
    })

    // Then
    expect(consoleLog).toHaveBeenCalledWith('Waiting for app logs...\n')
    expect(spy).toHaveBeenCalled()
  })
})

async function setupDevContext() {
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
  vi.mocked(ensureDevContext).mockResolvedValue({
    localApp: testApp(),
    remoteApp: testOrganizationApp(),
    remoteAppUpdated: false,
    updateURLs: false,
    storeFqdn: 'store-fqdn',
    storeId: '1',
  })
  vi.mocked(subscribeToAppLogs).mockResolvedValue('jwt-token')
}
