import {ensureDeploymentIdsPresence} from './identifiers'
import {automaticMatchmaking} from './id-matching'
import {manualMatchIds} from './id-manual-matching'
import {fetchAppExtensionRegistrations} from '../dev/fetch'
import {createExtension, ExtensionRegistration} from '../dev/create-extension'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {App, UIExtension} from 'cli/models/app/app'

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
}

const LOCAL_APP = (extensions: UIExtension[]): App => {
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
    extensions: {ui: extensions, theme: [], function: []},
  }
}

const options = (extensions: UIExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(extensions),
    token: 'token',
    appId: 'appId',
    envIdentifiers: {extensions: identifiers},
  }
}

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
    }
  })
  vi.mock('../dev/fetch')
  vi.mock('../dev/create-extension')
  vi.mock('./id-matching')
  vi.mock('./id-manual-matching')
})

describe('ensureDeploymentIdsPresence: case 1 no local nor remote extensions', () => {
  it('throw a nothing to deploy error', async () => {
    // Given
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({app: {extensionRegistrations: []}})

    // When
    const got = ensureDeploymentIdsPresence(options([]))

    // Then
    await expect(got).rejects.toThrow('There are no extensions to deploy')
  })
})

describe('ensureDeploymentIdsPresence: case 2 no local extension, some remote', () => {
  it('throw a nothing to deploy error', async () => {
    // Given
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({app: {extensionRegistrations: [REGISTRATION_A]}})

    // When
    const got = ensureDeploymentIdsPresence(options([]))

    // Then
    await expect(got).rejects.toThrow('There are no extensions to deploy')
  })
})

describe('ensureDeploymentIdsPresence: more remote than local extensions', () => {
  it('throw an invalid environment error', async () => {
    // Given
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_B]},
    })

    // When
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A]))

    // Then
    await expect(got).rejects.toThrow('This app has 2 registered extensions, but only 1 are locally available.')
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
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2]))

    // Then
    await expect(got).rejects.toThrow("We couldn't automatically match your local and remote extensions")
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with pending manual matches', () => {
  it('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
      toCreate: [],
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
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2]))

    // Then
    expect(manualMatchIds).toBeCalledWith([EXTENSION_A, EXTENSION_A_2, EXTENSION_B], [REGISTRATION_A, REGISTRATION_A_2])
    expect(got).toEqual({
      app: 'appId',
      extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B'},
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
    const got = ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2]))

    // Then
    await expect(got).rejects.toThrow('All remote extensions must be connected to a local extension in your project')
    expect(manualMatchIds).toBeCalledWith([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2])
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with pending some pending to create', () => {
  it('Create the pending extensions and suceeds', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {},
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
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2]))

    // Then
    await expect(createExtension).toBeCalledTimes(2)
    await expect(got).toEqual({app: 'appId', extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'}})
  })
})

describe('ensureDeploymentIdsPresence: matchmaking returns ok with nothing pending', () => {
  it('suceeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(fetchAppExtensionRegistrations).mockResolvedValueOnce({
      app: {extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2]},
    })

    // When
    const got = await ensureDeploymentIdsPresence(options([EXTENSION_A, EXTENSION_A_2]))

    // Then
    await expect(got).toEqual({app: 'appId', extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'}})
  })
})
