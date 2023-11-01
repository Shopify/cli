/* eslint-disable @shopify/prefer-module-scope-constants */
import {automaticMatchmaking} from './id-matching.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {deployConfirmationPrompt, extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {manualMatchIds} from './id-manual-matching.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testFunctionExtension, testOrganizationApp, testUIExtension} from '../../models/app/app.test-data.js'
import {getUIExtensionsToMigrate, migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {createExtension} from '../dev/create-extension.js'
import {beforeEach, describe, expect, vi, test, beforeAll} from 'vitest'
import {ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const REGISTRATION_A = {
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

const DASHBOARD_REGISTRATION_A = {
  uuid: 'UUID_DASHBOARD_A',
  id: 'DASHBOARD_A',
  title: 'DASHBOARD_A',
  type: 'APP_LINK',
}

const FUNCTION_REGISTRATION_A = {
  uuid: 'FUNCTION_A_UUID',
  id: 'FUNCTION_A',
  title: 'FUNCTION_A',
  type: 'FUNCTION',
}

let EXTENSION_A: ExtensionInstance
let EXTENSION_A_2: ExtensionInstance
let EXTENSION_B: ExtensionInstance
let FUNCTION_A: ExtensionInstance

const LOCAL_APP = (uiExtensions: ExtensionInstance[], functionExtensions: ExtensionInstance[] = []): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
    allExtensions: [...uiExtensions, ...functionExtensions],
  })
}

const options = (
  uiExtensions: ExtensionInstance[],
  functionExtensions: ExtensionInstance[] = [],
  identifiers: any = {},
  partnersApp: OrganizationApp = testOrganizationApp(),
  release = true,
) => {
  return {
    app: LOCAL_APP(uiExtensions, functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
    partnersApp,
    release,
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

beforeAll(async () => {
  EXTENSION_A = await testUIExtension({
    directory: 'EXTENSION_A',
    type: 'checkout_post_purchase',
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
  })

  EXTENSION_A_2 = await testUIExtension({
    directory: 'EXTENSION_A_2',
    type: 'checkout_post_purchase',
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

  EXTENSION_B = await testUIExtension({
    directory: 'EXTENSION_B',
    type: 'checkout_post_purchase',
    configuration: {
      name: 'EXTENSION_B',
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

  FUNCTION_A = await testFunctionExtension({
    dir: '/function',
    config: {
      name: 'FUNCTION A',
      type: 'product_discounts',
      description: 'Function',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
      },
      metafields: [],
      configuration_ui: false,
      api_version: '2022-07',
    },
  })
})

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(getUIExtensionsToMigrate).mockReturnValue([])
})

describe('ensureExtensionsIds: matchmaking returns more remote sources than local', () => {
  test('requires user confirmation to go through partial deploy', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_A]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
    })

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
  test('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [],
    })

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
          'extension-b': 'UUID_B',
        },
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2', 'extension-b': 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending manual matches and manual match fails', () => {
  test('requires user confirmation to proceed with deploy', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(got).toEqual(
      ok({
        extensions: {
          EXTENSION_A: 'UUID_A',
          'extension-a-2': 'UUID_A_3',
        },
        extensionIds: {EXTENSION_A: 'A', 'extension-a-2': 'A_3'},
      }),
    )
    expect(manualMatchIds).toBeCalledWith(
      {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'uuid',
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with pending some pending to create', () => {
  test('Create the pending extensions and succeeds', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(createExtension).toBeCalledTimes(2)
    expect(got).toEqual(
      ok({
        extensions: {'extension-a': 'UUID_A', 'extension-a-2': 'UUID_A_2'},
        extensionIds: {'extension-a': 'A', 'extension-a-2': 'A_2'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('confirms the pending ones and succeeds', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_B]), {
      extensionRegistrations: [REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(createExtension).not.toBeCalled()
    expect(got).toEqual(
      ok({
        extensions: {'extension-b': 'UUID_B'},
        extensionIds: {'extension-b': 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('does not confirm the pending ones and creates them as new extensions', async () => {
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
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_B]), {
      extensionRegistrations: [REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(createExtension).toBeCalledTimes(1)
    expect(got).toEqual(
      ok({
        extensions: {'extension-b': 'UUID_B'},
        extensionIds: {'extension-b': 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with nothing pending', () => {
  test('succeeds and returns all identifiers', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
      }),
    )
  })
})

describe('ensureExtensionsIds: includes functions', () => {
  test('succeeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', FUNCTION_A: 'FUNCTION_A_UUID'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(options([EXTENSION_A], [FUNCTION_A], {}, testOrganizationApp(), true), {
      extensionRegistrations: [REGISTRATION_A, FUNCTION_REGISTRATION_A],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(automaticMatchmaking).toHaveBeenCalledWith(
      [EXTENSION_A, FUNCTION_A],
      [REGISTRATION_A, FUNCTION_REGISTRATION_A],
      {},
      'uuid',
    )
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_A: 'UUID_A', FUNCTION_A: 'FUNCTION_A_UUID'},
        extensionIds: {EXTENSION_A: 'A', FUNCTION_A: 'FUNCTION_A'},
      }),
    )
  })
})

describe('ensureExtensionsIds: asks user to confirm deploy', () => {
  test('shows confirmation prompt when release is true', async () => {
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
    const opt = options([EXTENSION_A, EXTENSION_A_2], [], null, undefined, true)

    // When
    await ensureExtensionsIds(opt, {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [DASHBOARD_REGISTRATION_A],
    })

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith({
      summary: {
        appTitle: 'app1',
        question: `Release a new version of ${testOrganizationApp().title}?`,
        identifiers: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_2',
        },
        dashboardOnly: [DASHBOARD_REGISTRATION_A],
        toCreate: [],
      },
      release: true,
      apiKey: opt.appId,
      token: opt.token,
    })
  })

  test('shows confirmation prompt when release is false', async () => {
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
    const opt = options([EXTENSION_A, EXTENSION_A_2], [], null, undefined, false)

    // When
    await ensureExtensionsIds(opt, {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [DASHBOARD_REGISTRATION_A],
    })

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith({
      summary: {
        appTitle: 'app1',
        question: `Create a new version of ${testOrganizationApp().title}?`,
        identifiers: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_2',
        },
        dashboardOnly: [DASHBOARD_REGISTRATION_A],
        toCreate: [],
      },
      release: false,
      apiKey: opt.appId,
      token: opt.token,
    })
  })

  test('skips confirmation prompt if --force is passed', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      toConfirm: [{local: EXTENSION_B, remote: REGISTRATION_B}],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(createExtension).mockResolvedValueOnce(REGISTRATION_B)

    const opts = options([EXTENSION_A, EXTENSION_A_2, EXTENSION_B])
    opts.force = true

    // When
    await ensureExtensionsIds(opts, {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2, REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(deployConfirmationPrompt).not.toBeCalled()
    expect(matchConfirmationPrompt).toBeCalled()
  })
})

describe('ensureExtensionsIds: Migrates extension', () => {
  test('shows confirmation prompt', async () => {
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
    vi.mocked(getUIExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)

    // When
    await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2]), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(extensionMigrationPrompt).toBeCalledWith(extensionsToMigrate)
  })

  test('migrates extensions', async () => {
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
    vi.mocked(getUIExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)
    vi.mocked(extensionMigrationPrompt).mockResolvedValueOnce(true)
    const opts = options([EXTENSION_A, EXTENSION_A_2])
    const remoteExtensions = [REGISTRATION_A, REGISTRATION_A_2]

    // When
    await ensureExtensionsIds(opts, {
      extensionRegistrations: remoteExtensions,
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(migrateExtensionsToUIExtension).toBeCalledWith(extensionsToMigrate, opts.appId, remoteExtensions)
  })
})
