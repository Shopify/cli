/* eslint-disable @shopify/prefer-module-scope-constants */
import {automaticMatchmaking} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {RemoteSource} from './identifiers.js'
import {deployConfirmationPrompt, matchConfirmationPrompt} from './prompts.js'
import {AppInterface} from '../../models/app/app.js'
import {testApp, testFunctionExtension} from '../../models/app/app.test-data.js'
import {DeploymentMode} from '../deploy/mode.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, vi, test, beforeAll} from 'vitest'
import {ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

const REGISTRATION_A: RemoteSource = {
  uuid: 'UUID_A',
  id: 'ID_A',
  title: 'A',
  type: 'PRODUCT_DISCOUNTS',
}

const REGISTRATION_A_2 = {
  uuid: 'UUID_A_2',
  id: 'ID_A_2',
  title: 'A_2',
  type: 'PRODUCT_DISCOUNTS',
}

const REGISTRATION_B = {
  uuid: 'UUID_B',
  id: 'ID_B',
  title: 'B',
  type: 'ORDER_DISCOUNTS',
}

let FUNCTION_A: ExtensionInstance
let FUNCTION_A_2: ExtensionInstance
let FUNCTION_B: ExtensionInstance

const LOCAL_APP = (functionExtensions: ExtensionInstance[]): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configuration: {path: '/shopify.app.toml', scopes: 'read_products', extension_directories: ['extensions/*']},
    allExtensions: functionExtensions,
  })
}

const options = (
  functionExtensions: ExtensionInstance[],
  identifiers: any = {},
  deploymentMode: DeploymentMode = 'legacy',
) => {
  return {
    app: LOCAL_APP(functionExtensions),
    token: 'token',
    appId: 'appId',
    appName: 'appName',
    envIdentifiers: {extensions: identifiers},
    force: false,
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
  }
})
vi.mock('./id-matching')
vi.mock('./id-manual-matching')

beforeAll(async () => {
  FUNCTION_A = await testFunctionExtension({
    dir: '/FUNCTION_A',
    config: {
      name: 'FUNCTION A',
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

  FUNCTION_A_2 = await testFunctionExtension({
    dir: '/FUNCTION_A_2',
    config: {
      name: 'FUNCTION A 2',
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

  FUNCTION_B = await testFunctionExtension({
    dir: '/FUNCTION_B',
    config: {
      name: 'FUNCTION B',
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
})

describe('ensureFunctionsIds: matchmaking returns ok with pending manual matches', () => {
  test('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [FUNCTION_A, FUNCTION_A_2, FUNCTION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
      toCreate: [FUNCTION_B],
      onlyRemote: [],
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(manualMatchIds).toHaveBeenCalledWith(
      {local: [FUNCTION_A, FUNCTION_A_2, FUNCTION_B], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'id',
    )
    expect(got).toEqual(
      ok({
        FUNCTION_A: 'ID_A',
        FUNCTION_A_2: 'ID_A_2',
      }),
    )
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with pending manual matches and manual match fails', () => {
  test('requires confirmation before proceeding with deploy', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(true)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [FUNCTION_A],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
    })
    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      identifiers: {FUNCTION_A: 'ID_A'},
      toCreate: [],
      onlyRemote: [REGISTRATION_A_2],
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(
      ok({
        FUNCTION_A: 'ID_A',
      }),
    )
    expect(manualMatchIds).toBeCalledWith({local: [FUNCTION_A], remote: [REGISTRATION_A, REGISTRATION_A_2]}, 'id')
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending to create', () => {
  test('Returns an empty object as functions will be automatically created when deployed', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [],
      toCreate: [FUNCTION_A, FUNCTION_A_2],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    const opts = options([FUNCTION_A, FUNCTION_A_2])

    // When
    const got = await ensureFunctionsIds(opts, [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(ok({}))
    expect(deployConfirmationPrompt).toHaveBeenCalledWith(
      {
        appTitle: 'my-app',
        question: 'Make the following changes to your functions in Shopify Partners?',
        identifiers: {},
        onlyRemote: [],
        toCreate: [FUNCTION_A, FUNCTION_A_2],
        dashboardOnly: [],
      },
      opts,
    )
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('confirms the pending ones and succeeds', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(true)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [{local: FUNCTION_B, remote: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_B]), [REGISTRATION_B])

    // Then
    expect(got).toEqual(
      ok({
        'function-b': 'ID_B',
      }),
    )
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('do not confirms the pending ones and returns an empty object as functions will be automatically created when deployed', async () => {
    // Given
    vi.mocked(matchConfirmationPrompt).mockResolvedValueOnce(false)
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {},
      toConfirm: [{local: FUNCTION_B, remote: REGISTRATION_B}],
      toCreate: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    const opts = options([FUNCTION_B])

    // When
    const got = await ensureFunctionsIds(opts, [REGISTRATION_B])

    // Then
    expect(got).toEqual(ok({}))
    expect(deployConfirmationPrompt).toHaveBeenCalledWith(
      {
        appTitle: 'my-app',
        question: 'Make the following changes to your functions in Shopify Partners?',
        identifiers: {},
        onlyRemote: [],
        toCreate: [FUNCTION_B],
        dashboardOnly: [],
      },
      opts,
    )
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with nothing pending', () => {
  test('succeeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(
      ok({
        FUNCTION_A: 'ID_A',
        FUNCTION_A_2: 'ID_A_2',
      }),
    )
  })
})

describe('ensureFunctionsIds: asks user to confirm deploy', () => {
  test('shows confirmation prompt', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
      toCreate: [],
      toConfirm: [],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })
    vi.mocked(deployConfirmationPrompt).mockResolvedValueOnce(true)
    const opts = options([FUNCTION_A, FUNCTION_A_2])

    // When
    await ensureFunctionsIds(opts, [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith(
      {
        appTitle: 'my-app',
        question: 'Make the following changes to your functions in Shopify Partners?',
        identifiers: {
          FUNCTION_A: 'ID_A',
          FUNCTION_A_2: 'ID_A_2',
        },
        onlyRemote: [],
        toCreate: [],
        dashboardOnly: [],
      },
      opts,
    )
  })

  test('skips confirmation prompt if --force is passed', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce({
      identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
      toCreate: [],
      toConfirm: [{local: FUNCTION_A, remote: REGISTRATION_A}],
      toManualMatch: {
        local: [],
        remote: [],
      },
    })

    const opts = options([FUNCTION_A, FUNCTION_A_2])
    opts.force = true

    // When
    await ensureFunctionsIds(opts, [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(deployConfirmationPrompt).not.toBeCalled()
    expect(matchConfirmationPrompt).toBeCalled()
  })
})
