/* eslint-disable @shopify/prefer-module-scope-constants */
import {ensureDeploymentIdsPresence, RemoteSource} from './identifiers.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testFunctionExtension, testOrganizationApp, testUIExtension} from '../../models/app/app.test-data.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {DeploymentMode} from '../deploy/mode.js'
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
    configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
    allExtensions: [...uiExtensions, ...functionExtensions],
  })
}

const PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA = testOrganizationApp({
  betas: {unifiedAppDeployment: true},
})

const options = (
  uiExtensions: ExtensionInstance[],
  functionExtensions: ExtensionInstance[],
  identifiers: any = {},
  partnersApp?: OrganizationApp,
  deploymentMode: DeploymentMode = 'legacy',
) => {
  return {
    app: LOCAL_APP(uiExtensions, functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
    partnersApp,
    deploymentMode,
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
    directory: '/EXTENSION_A',
    configuration: {
      name: 'EXTENSION A',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_A_2 = await testUIExtension({
    directory: '/EXTENSION_A_2',
    configuration: {
      name: 'EXTENSION A 2',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
        },
      },
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
      configuration_ui: false,
      api_version: '2022-07',
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
      options(
        [EXTENSION_A, EXTENSION_A_2],
        [FUNCTION_C],
        {},
        PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA,
        'unified',
      ),
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

describe('app has no local extensions', () => {
  test('ensureDeploymentIdsPresence() returns early when deploymentMode is legacy', async () => {
    // When
    const got = await ensureDeploymentIdsPresence(options([], []))

    // Then
    expect(fetchAppExtensionRegistrations).not.toHaveBeenCalled()
    expect(ensureFunctionsIds).not.toHaveBeenCalled()
    expect(ensureExtensionsIds).not.toHaveBeenCalled()
    expect(got).toEqual({app: 'appId', extensions: {}, extensionIds: {}})
  })

  test('ensureDeploymentIdsPresence() fully executes when deploymentMode is unified', async () => {
    // Given
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = await ensureDeploymentIdsPresence(
      options([], [], {}, PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA, 'unified'),
    )

    // Then
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
    expect(ensureExtensionsIds).toHaveBeenCalledOnce()
    expect(got).toEqual({app: 'appId', extensions: {}, extensionIds: {}})
  })

  test('ensureDeploymentIdsPresence() fully executes when deploymentMode is unified-skip-release', async () => {
    // Given
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = await ensureDeploymentIdsPresence(
      options([], [], {}, PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA, 'unified-skip-release'),
    )

    // Then
    expect(fetchAppExtensionRegistrations).toHaveBeenCalledOnce()
    expect(ensureExtensionsIds).toHaveBeenCalledOnce()
    expect(got).toEqual({app: 'appId', extensions: {}, extensionIds: {}})
  })
})
