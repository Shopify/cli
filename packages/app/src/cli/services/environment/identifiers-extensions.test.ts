import {automaticMatchmaking} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {RemoteSource} from './identifiers.js'
import {createExtension} from '../dev/create-extension.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension, UIExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {err, ok} from '@shopify/cli-kit/common/result'
import {ui} from '@shopify/cli-kit'

const REGISTRATION_A: RemoteSource = {
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
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
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
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
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
  configuration: {
    name: '',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
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

const options = (uiExtensions: UIExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(uiExtensions),
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
  vi.mock('../dev/create-extension')
  vi.mock('./id-matching')
  vi.mock('./id-manual-matching')
})

describe('ensureExtensionsIds: matchmaking returns invalid', () => {
  it('throw an invalid environment error', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(err('invalid-environment'))

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_B])

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending manual matches', () => {
  it('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
          remote: [REGISTRATION_A, REGISTRATION_A_2],
        },
      }),
    )

    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [EXTENSION_B],
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(manualMatchIds).toHaveBeenCalledWith(
      {local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'uuid',
    )
    expect(got).toEqual(
      ok({
        extensions: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_2',
          EXTENSION_B: 'UUID_B',
        },
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2', EXTENSION_B: 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending manual matches and manual match fails', () => {
  it('throws an error for missing remote extension matches', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [EXTENSION_A],
          remote: [REGISTRATION_A, REGISTRATION_A_2],
        },
      }),
    )
    vi.mocked(manualMatchIds).mockResolvedValueOnce({result: 'pending-remote'})

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(err('pending-remote'))
    expect(manualMatchIds).toBeCalledWith({local: [EXTENSION_A], remote: [REGISTRATION_A, REGISTRATION_A_2]}, 'uuid')
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending some pending to create', () => {
  it('Create the pending extensions and suceeds', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [],
        toCreate: [EXTENSION_A, EXTENSION_A_2],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A)
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A_2)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(createExtension).toBeCalledTimes(2)
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with some pending confirmation', () => {
  it('confirms the pending ones and suceeds', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'yes'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [{local: EXTENSION_B, remote: REGISTRATION_B}],
        toCreate: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_B]), [REGISTRATION_B])

    // Then
    expect(createExtension).not.toBeCalled()
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_B: 'UUID_B'},
        extensionIds: {EXTENSION_B: 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with some pending confirmation', () => {
  it('do not confirms the pending ones and fails', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'no'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [{local: EXTENSION_B, remote: REGISTRATION_B}],
        toCreate: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_B]), [REGISTRATION_B])

    // Then
    expect(got).toEqual(err('user-cancelled'))
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with nothing pending', () => {
  it('suceeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
      }),
    )
  })
})
