/* eslint-disable @shopify/prefer-module-scope-constants */
import {automaticMatchmaking} from './id-matching.js'
import {ensureExtensionsIds} from './identifiers-extensions.js'
import {deployConfirmationPrompt, extensionMigrationPrompt, matchConfirmationPrompt} from './prompts.js'
import {manualMatchIds} from './id-manual-matching.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testFunctionExtension, testUIExtension} from '../../models/app/app.test-data.js'
import {getExtensionsToMigrate, migrateExtensionsToUIExtension} from '../dev/migrate-to-ui-extension.js'
import {OrganizationApp} from '../../models/organization.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {createExtension} from '../dev/create-extension.js'
import {DeploymentMode} from '../deploy/mode.js'
import {beforeEach, describe, expect, vi, test, beforeAll} from 'vitest'
import {err, ok} from '@shopify/cli-kit/node/result'
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
}

const PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA: OrganizationApp = {
  id: 'app-id',
  organizationId: 'org-id',
  title: 'app-title',
  grantedScopes: [],
  apiKey: 'api-key',
  apiSecretKeys: [],
}

const options = (
  uiExtensions: ExtensionInstance[],
  functionExtensions: ExtensionInstance[] = [],
  identifiers: any = {},
  partnersApp: OrganizationApp = PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA,
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
    localIdentifier: 'EXTENSION_A',
    configurationPath: '',
    directory: 'EXTENSION_A',
    type: 'checkout_post_purchase',
    configuration: {
      name: '',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {network_access: false, block_progress: false, api_access: false},
    },
    entrySourceFilePath: '',
  })

  EXTENSION_A_2 = await testUIExtension({
    localIdentifier: 'EXTENSION_A_2',
    configurationPath: '',
    directory: 'EXTENSION_A_2',
    type: 'checkout_post_purchase',
    configuration: {
      name: '',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {network_access: false, block_progress: false, api_access: false},
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_B = await testUIExtension({
    localIdentifier: 'EXTENSION_B',
    configurationPath: '',
    directory: 'EXTENSION_B',
    type: 'checkout_post_purchase',
    configuration: {
      name: '',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {network_access: false, block_progress: false, api_access: false},
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  FUNCTION_A = await testFunctionExtension({
    dir: '/function',
    config: {
      name: '',
      type: 'product_discounts',
      description: 'Function',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
      },
      metafields: [],
      configurationUi: false,
      apiVersion: '2022-07',
    },
  })
})

beforeEach(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
  vi.mocked(getExtensionsToMigrate).mockReturnValue([])
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
          EXTENSION_B: 'UUID_B',
        },
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2', EXTENSION_B: 'B'},
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
        extensions: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
        extensionIds: {EXTENSION_A: 'A', EXTENSION_A_2: 'A_2'},
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
        extensions: {EXTENSION_B: 'UUID_B'},
        extensionIds: {EXTENSION_B: 'B'},
      }),
    )
  })
})

describe('ensureExtensionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('do not confirms the pending ones and fails', async () => {
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
    const got = await ensureExtensionsIds(options([EXTENSION_B]), {
      extensionRegistrations: [REGISTRATION_B],
      dashboardManagedExtensionRegistrations: [],
    })

    // Then
    expect(got).toEqual(err('user-cancelled'))
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

describe('ensureExtensionsIds: excludes functions when unifiedAppDeployment beta is not set', () => {
  test('succeeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {EXTENSION_A: 'UUID_A'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureExtensionsIds(
      options([EXTENSION_A], [FUNCTION_A], {}, PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA),
      {
        extensionRegistrations: [REGISTRATION_A, FUNCTION_REGISTRATION_A],
        dashboardManagedExtensionRegistrations: [],
      },
    )

    // Then
    expect(automaticMatchmaking).toHaveBeenCalledWith(
      [EXTENSION_A],
      [REGISTRATION_A, FUNCTION_REGISTRATION_A],
      {},
      'uuid',
    )
    expect(got).toEqual(
      ok({
        extensions: {EXTENSION_A: 'UUID_A'},
        extensionIds: {EXTENSION_A: 'A'},
      }),
    )
  })
})

describe('ensureExtensionsIds: includes functions when unifiedAppDeployment beta is set', () => {
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
    const got = await ensureExtensionsIds(
      options([EXTENSION_A], [FUNCTION_A], {}, PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA, 'unified'),
      {
        extensionRegistrations: [REGISTRATION_A, FUNCTION_REGISTRATION_A],
        dashboardManagedExtensionRegistrations: [],
      },
    )

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
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    await ensureExtensionsIds(options([EXTENSION_A, EXTENSION_A_2], [], null, undefined, 'unified'), {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
      dashboardManagedExtensionRegistrations: [DASHBOARD_REGISTRATION_A],
    })

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith(
      {
        question: `Release a new version of ${PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA.title}?`,
        identifiers: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_2',
        },
        onlyRemote: [],
        dashboardOnly: [DASHBOARD_REGISTRATION_A],
        toCreate: [],
      },
      'unified',
      PARTNERS_APP_WITH_UNIFIED_APP_DEPLOYMENTS_BETA,
    )
  })

  test('does not include dashboard managed extensions in confirmation prompt if the beta flag is off', async () => {
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
    await ensureExtensionsIds(
      options([EXTENSION_A, EXTENSION_A_2], [], {}, PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA),
      {
        extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
        dashboardManagedExtensionRegistrations: [DASHBOARD_REGISTRATION_A],
      },
    )

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith(
      {
        question: 'Make the following changes to your extensions in Shopify Partners?',
        identifiers: {
          EXTENSION_A: 'UUID_A',
          EXTENSION_A_2: 'UUID_A_2',
        },
        onlyRemote: [],
        dashboardOnly: [],
        toCreate: [],
      },
      'legacy',
      PARTNERS_APP_WITHOUT_UNIFIED_APP_DEPLOYMENTS_BETA,
    )
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

    const opts = options([EXTENSION_A, EXTENSION_A_2])
    opts.force = true

    // When
    await ensureExtensionsIds(opts, {
      extensionRegistrations: [REGISTRATION_A, REGISTRATION_A_2],
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
    vi.mocked(getExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)

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
    vi.mocked(getExtensionsToMigrate).mockReturnValueOnce(extensionsToMigrate)
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
