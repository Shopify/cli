import {ensureDeploymentIdsPresence, RemoteSource} from './identifiers.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {fetchAppExtensionRegistrations} from '../dev/fetch.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension, UIExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
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

const EXTENSION_A: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_ID',
  localIdentifier: 'EXTENSION_A',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  validate: () => Promise.resolve({} as any),
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
}

const EXTENSION_A_2: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_2_ID',
  localIdentifier: 'EXTENSION_A_2',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  validate: () => Promise.resolve({} as any),
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
}

const FUNCTION_C: FunctionExtension = {
  idEnvironmentVariableName: 'FUNCTION_C_ID',
  localIdentifier: 'FUNCTION_C',
  configurationPath: '/function/shopify.function.extension.toml',
  directory: '/function',
  type: 'product_discounts',
  graphQLType: 'PRODUCT_DISCOUNTS',
  configuration: {
    name: '',
    type: 'product_discounts',
    description: 'Function',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configurationUi: false,
    apiVersion: '2022-07',
  },
  buildWasmPath: () => '/function/dist/index.wasm',
  inputQueryPath: () => '/function/input.graphql',
  externalType: 'function',
  publishURL: (_) => Promise.resolve(''),
}

const LOCAL_APP = (uiExtensions: UIExtension[], functionExtensions: FunctionExtension[] = []): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configurationPath: '/shopify.app.toml',
    configuration: {scopes: 'read_products', extensionDirectories: ['extensions/*']},
    extensions: {ui: uiExtensions, theme: [], function: functionExtensions},
  })
}

const options = (uiExtensions: UIExtension[], functionExtensions: FunctionExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(uiExtensions, functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
  }
}

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/session')
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mock('../dev/fetch')
  vi.mock('./identifiers-extensions')
  vi.mock('./identifiers-functions')
  vi.mocked(fetchAppExtensionRegistrations).mockResolvedValue({
    app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_B], functions: [REGISTRATION_C]},
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns invalid', () => {
  it('throw an invalid environment error if functions is invalid', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(err('invalid-environment'))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })

  it('throw an invalid environment error if there are pending remote matches', async () => {
    // Given
    vi.mocked(ensureFunctionsIds).mockResolvedValue(err('pending-remote'))
    vi.mocked(ensureExtensionsIds).mockResolvedValue(ok({extensions: {}, extensionIds: {}}))

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [FUNCTION_C]))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })

  it('throw an invalid environment error if extensions is invalid', async () => {
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
  it('returns the combination of functions and extensions', async () => {
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
})
