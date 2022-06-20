import {ensureDeploymentIdsPresence} from './identifiers'
import {automaticMatchmaking} from './id-matching'
import {manualMatchIds} from './id-manual-matching'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension, ExtensionRegistration} from '../dev/create-extension'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {App, FunctionExtension, UIExtension} from 'cli/models/app/app'
import {ui} from '@shopify/cli-kit'

const REGISTRATION_A: ExtensionRegistration = {
  uuid: 'UUID_A',
  id: 'A',
  title: 'A',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_A_2 = {
  uuid: 'UUID_A_2',
  id: 'A_2',
  title: 'A_2',
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
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_A_2: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_2_ID',
  localIdentifier: 'EXTENSION_A_2',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_B: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_B_ID',
  localIdentifier: 'EXTENSION_B',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_C: FunctionExtension = {
  metadata: {
    schemaVersions: {},
  },
  idEnvironmentVariableName: 'EXTENSION_C_ID',
  localIdentifier: 'EXTENSION_C',
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
  },
  buildWasmPath: () => '/function/dist/index.wasm',
  inputQueryPath: () => '/function/input.graphql',
}

const LOCAL_APP = (uiExtensions: UIExtension[], functionExtensions: FunctionExtension[] = []): App => {
  return {
    name: 'my-app',
    idEnvironmentVariableName: 'SHOPIFY_APP_ID',
    directory: '/app',
    dependencyManager: 'yarn',
    configurationPath: '/shopify.app.toml',
    configuration: {scopes: 'read_products'},
    webs: [],
    nodeDependencies: {},
    environment: {
      dotenv: {},
      env: {},
    },
    extensions: {ui: uiExtensions, theme: [], function: functionExtensions},
  }
}

const options = (uiExtensions: UIExtension[], functionExtensions: FunctionExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(uiExtensions, functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
  }
}

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {ensureAuthenticatedPartners: async () => 'token'},
      ui: {prompt: vi.fn()},
    }
  })
  vi.mock('../dev/fetch')
  vi.mock('../dev/create-extension')
  vi.mock('./id-matching')
  vi.mock('./id-manual-matching')
})

describe('ensureDeploymentIdsPresence: more remote than local extensions', () => {
  it('throw an invalid environment error', async () => {
    // Given
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_B]},
    })

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A], []))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns invalid', () => {
  it('throw an invalid environment error', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({result: 'invalid-environment'})
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_B]},
    })

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], []))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with pending manual matches', () => {
  it('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      toCreate: [],
      pendingConfirmation: [],
      toManualMatch: {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [EXTENSION_B],
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], []))

    // Then
    expect(manualMatchIds).toBeCalledWith([EXTENSION_A, EXTENSION_A_2, EXTENSION_B], [REGISTRATION_A, REGISTRATION_A_2])
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B'},
      extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2', EXTENSION_B: 'B'},
    })
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with pending manual matches and manual match fails', () => {
  it('throws an error for missing remote extension matches', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      toCreate: [],
      pendingConfirmation: [],
      toManualMatch: {
        local: [EXTENSION_A],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({result: 'pending-remote'})

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], []))

    // Then
    await expect(got).rejects.toThrow(/Deployment failed because this local project doesn't seem to match the app/)
    expect(manualMatchIds).toBeCalledWith([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2])
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with pending some pending to create', () => {
  it('Create the pending extensions and suceeds', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      pendingConfirmation: [],
      toCreate: [EXTENSION_A, EXTENSION_A_2],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A)
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A_2)
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], []))

    // Then
    expect(createExtension).toBeCalledTimes(2)
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
    })
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with some pending confirmation', () => {
  it('confirms the pending ones and suceeds', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'yes'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      pendingConfirmation: [{extension: EXTENSION_B, registration: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({app: {extensionRegistrations: [REGISTRATION_B]}})

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_B], []))

    // Then
    expect(createExtension).not.toBeCalled()
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_B: 'UUID_B'},
      extensionIds: {EXTENSION_B: 'B'},
    })
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with some pending confirmation', () => {
  it('do not confirms the pending ones and fails', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'no'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      pendingConfirmation: [{extension: EXTENSION_B, registration: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({app: {extensionRegistrations: [REGISTRATION_B]}})

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_B], []))

    // Then
    await expect(got).rejects.toThrow()
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with nothing pending', () => {
  it('suceeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      pendingConfirmation: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], []))

    // Then
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
    })
  })
})

describe("ensureDeploymentIdsPresence: doesn't override existing functions' ids", () => {
  it('returns an identifiers instance that contains the existing id for the function', async () => {
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_C]},
    })
    const envIdentifiers: {[key: string]: string} = {}
    envIdentifiers[EXTENSION_C.localIdentifier] = 'UUID_C'

    // When
    const got = await ensureDeploymentIdsPresence(options([], [EXTENSION_C], envIdentifiers))

    // Then
    expect(got).toEqual({app: 'appId', extensions: {EXTENSION_C: 'UUID_C'}, extensionIds: {}})
  })

  it('returns the ids of matched UI extensions and existing functions', async () => {
    // Given
    const envIdentifiers: {[key: string]: string} = {}
    envIdentifiers[EXTENSION_C.localIdentifier] = 'UUID_C'
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      toCreate: [],
      pendingConfirmation: [],
      toManualMatch: {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [EXTENSION_B],
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2], [EXTENSION_C], envIdentifiers))

    // Then
    expect(manualMatchIds).toBeCalledWith([EXTENSION_A, EXTENSION_A_2, EXTENSION_B], [REGISTRATION_A, REGISTRATION_A_2])
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B', EXTENSION_C: 'UUID_C'},
      extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2', EXTENSION_B: 'B'},
    })
  })
})
