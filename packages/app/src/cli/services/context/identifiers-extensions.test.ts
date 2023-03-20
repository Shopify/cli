import {automaticMatchmaking} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {RemoteSource} from './identifiers.js'
import {deployConfirmationPrompt, extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {createExtension} from '../dev/create-extension.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension, UIExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
import {getExtensionsToMigrate, migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {err, ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

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

const REGISTRATION_A_3 = {
  uuid: 'UUID_A_3',
  id: 'A_3',
  title: 'A_3',
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
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
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
}

const LOCAL_APP = (uiExtensions: UIExtension[], functionExtensions: FunctionExtension[] = []): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configurationPath: '/shopify.app.toml',
    configuration: {scopes: 'read_products', extensionDirectories: ['extensions/*']},
    extensions: {ui: uiExtensions, theme: [], function: functionExtensions, configurations: []},
  })
}

const options = (uiExtensions: UIExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(uiExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
  }
}

vi.mock('@shopify/cli-kit/node/session')
vi.mock('./prompts', async () => {
  const prompts: any = await vi.importActual('./prompts')
  return {
    ...prompts,
    matchConfirmationPrompt: vi.fn(),
    deployConfirmationPrompt: vi.fn(),
    extensionMigrationPrompt: vi.fn(),
  }
})
vi.mock('../dev/create-extension')
vi.mock('./id-matching')
vi.mock('./id-manual-matching')
vi.mock('../dev/migrate-to-ui-extension')

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(getExtensionsToMigrate).mockReturnValue([])
})

describe('ensureExtensionsIds: matchmaking returns more remote sources than local', () => {
  it('requires user confirmation to go through partial deploy', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(true)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [REGISTRATION_B],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A]), [REGISTRATION_A, REGISTRATION_B])

    // Then
    expect(got).toEqual(
      ok({
        extensions: {
          EXTENSION_A: 'UUID_A',
        },
        extensionIds: {EXTENSION_A: 'A'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending manual matches', () => {
  it('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })

    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [EXTENSION_B],
      onlyRemote: [],
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

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
  it('requires user confirmation to proceed with deploy', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(true)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [EXTENSION_A, EXTENSION_A_2],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A'},
      toCreate: [EXTENSION_A_2],
      onlyRemote: [REGISTRATION_A_2],
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A_3)
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(
      ok({
        extensions: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_3',
        },
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_3'},
      }),
    )
    expect(manualMatchIds).toBeCalledWith(
      {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'uuid',
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending some pending to create', () => {
  it('Create the pending extensions and succeeds', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_A_2],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A)
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_A_2)
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

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
  it('confirms the pending ones and succeeds', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(true)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [{local: EXTENSION_B, remote: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

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
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(false)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [{local: EXTENSION_B, remote: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_B]), [REGISTRATION_B])

    // Then
    expect(got).toEqual(err('user-cancelled'))
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with nothing pending', () => {
  it('succeeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

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

describe('ensureExtensionsIds: asks user to confirm deploy', () => {
  it('shows confirmation prompt', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith({
      question: 'Make the following changes to your extensions in Shopify Partners?',
      identifiers: {
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
      },
      onlyRemote: [],
      toCreate: [],
    })
  })

  it('skips confirmation prompt if --force is passed', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })

    const opts = options([EXTENSION_A, EXTENSION_A_2])
    opts.force = true

    // When
    await ensureExtensionsIds(opts, [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(deployConfirmationPrompt).not.toBeCalled()
  })
})

describe('ensureExtensionsIds: Migrates extension', () => {
  it('shows confirmation prompt', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    const extensionsToMigrate = [
      {local: EXTENSION_A, remote: REGISTRATION_A},
      {local: EXTENSION_A_2, remote: REGISTRATION_A_2},
    ]
    vi.mocked(getExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)

    // When
    await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(extensionMigrationPrompt).toBeCalledWith(extensionsToMigrate)
  })

  it('migrates extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    const extensionsToMigrate = [
      {local: EXTENSION_A, remote: REGISTRATION_A},
      {local: EXTENSION_A_2, remote: REGISTRATION_A_2},
    ]
    vi.mocked(getExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)
    vi.mocked(extensionMigrationPrompt).mockResolvedValueOnce(true)
    const opts = options([EXTENSION_A, EXTENSION_A_2])
    const remoteExtensions = [REGISTRATION_A, REGISTRATION_A_2]

    // When
    await ensureExtensionsIds(opts, remoteExtensions)

    // Then
    expect(migrateExtensionsToUIExtension).toBeCalledWith(extensionsToMigrate, opts.appId, remoteExtensions)
  })
})
