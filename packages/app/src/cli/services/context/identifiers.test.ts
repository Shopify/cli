/* eslint-disable @shopify/prefer-module-scope-constants */
import {ensureDeploymentIdsPresence, RemoteSource} from './identifiers.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testFunctionExtension, testUIExtension} from '../../models/app/app.test-data.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, vi, test, beforeAll} from 'vitest'
import {err, ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const REGISTRATION_A: RemoteSource = {
  uuid: 'UUID_A',
  id: 'A',
  title: 'A',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_B = {
  uuid: 'UUID_B',
  id: 'B',
  title: 'B',
  type: 'SUBSCRIPTION_MANAGEMENT',
}

const REGISTRATION_C = {
  uuid: 'UUID_C',
  id: 'C',
  title: 'C',
  type: 'PRODUCT_DISCOUNTS',
}

const LOCAL_APP = (uiExtensions: ExtensionInstance[], functionExtensions: ExtensionInstance[] = []): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configurationPath: '/shopify.app.toml',
    configuration: {scopes: 'read_products', extensionDirectories: ['extensions/*']},
    allExtensions: [...uiExtensions, ...functionExtensions],
  })
}

const PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA: OrganizationApp = {
  id: 'app-id',
  organizationId: 'org-id',
  title: 'app-title',
  grantedScopes: [],
  betas: {unifiedAppDeployment: true},
  apiKey: 'api-key',
  apiSecretKeys: [],
  applicationUrl: 'https://example.com',
}

const options = (
  uiExtensions: ExtensionInstance[],
  functionExtensions: ExtensionInstance[],
  identifiers: any = {},
  partnersApp?: OrganizationApp,
) => {
  return {
    app: LOCAL_APP(uiExtensions, functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
    partnersApp,
  }
}

let EXTENSION_A: ExtensionInstance
let EXTENSION_A_2: ExtensionInstance
let FUNCTION_C: ExtensionInstance

vi.mock('@shopify/cli-kit/node/session')
vi.mock('../dev/fetch')
vi.mock('./identifiers-extensions')
vi.mock('./identifiers-functions')

beforeAll(async () => {
  EXTENSION_A = await testUIExtension({
    configurationPath: '',
    directory: '/EXTENSION_A',
    configuration: {
      name: 'EXTENSION A',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {network_access: false, block_progress: false, api_access: false},
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_A_2 = await testUIExtension({
    configurationPath: '',
    directory: '/EXTENSION_A_2',
    configuration: {
      name: 'EXTENSION A 2',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {network_access: false, block_progress: false, api_access: false},
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  FUNCTION_C = await testFunctionExtension({
    dir: '/FUNCTION_C',
    config: {
      name: 'FUNCTION_C',
      type: 'product_discounts',
      description: 'Function',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
      },
      configurationUi: false,
      apiVersion: '2022-07',
      metafields: [],
    },
  })
})

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
    app: {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
      functions: [REGISTRATION_C],
    },
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns invalid', () => {
  test('throw an invalid environment error if functions is invalid', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(err('invalid-environment'))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })

  test('throw an invalid environment error if there are pending remote matches', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(err('pending-remote'))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })

  test('throw an invalid environment error if extensions is invalid', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(ok({}))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(err('invalid-environment'))

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })
})

describe('ensureDeploymentIdsPresence: matchmaking is valid', () => {
  test('returns the combination of functions and extensions', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(ok({FUNCTION_A: 'ID_A', FUNCTION_B: 'ID_B'}))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(
      ok({extensions: {EXTENSION_A: 'UUID_A'}, extensionIds: {EXTENSION_A: 'ID_A'}}),
    )

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', FUNCTION_A: 'ID_A', FUNCTION_B: 'ID_B'},
      extensionIds: {EXTENSION_A: 'ID_A'},
    })
  })

  test('treats functions as extensions when unifiedAppDeployment beta is set', async () => {
    // Given
    vi.mocked(ensureExtensionsIds).mockResolvedValue(
      ok({
        extensions: {EXTENSION_A: 'UUID_A', FUNCTION_A: 'FUNCTION_UUID_A'},
        extensionIds: {EXTENSION_A: 'ID_A', FUNCTION_A: 'FUNCTION_ID_A'},
      }),
    )

    // When
    const got = await ensureDeploymentIdsPresence(
      options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C], {}, PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA),
    )

    // Then
    expect(ensureFunctionsIds).not.toHaveBeenCalledOnce()
    await expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', FUNCTION_A: 'FUNCTION_UUID_A'},
      extensionIds: {EXTENSION_A: 'ID_A', FUNCTION_A: 'FUNCTION_ID_A'},
    })
  })
})
