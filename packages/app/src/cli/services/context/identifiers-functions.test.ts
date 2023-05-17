import {automaticMatchmaking} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {RemoteSource} from './identifiers.js'
import {deployConfirmationPrompt, matchConfirmationPrompt} from './prompts.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {err, ok} from '@shopify/cli-kit/node/result'
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

const FUNCTION_A: FunctionExtension = {
  idEnvironmentVariableName: 'FUNCTION_A_ID',
  localIdentifier: 'FUNCTION_A',
  configurationPath: '/function/shopify.function.extension.toml',
  directory: '/function',
  type: 'product_discounts',
  graphQLType: 'PRODUCT_DISCOUNTS',
  configuration: {
    name: 'FUNCTION A',
    type: 'product_discounts',
    description: 'Function',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configurationUi: false,
    apiVersion: '2022-07',
  },
  buildCommand: 'make build',
  buildWasmPath: '/function/dist/index.wasm',
  inputQueryPath: '/function/input.graphql',
  isJavaScript: false,
  externalType: 'function',
  usingExtensionsFramework: false,
  publishURL: (_) => Promise.resolve(''),
}

const FUNCTION_A_2: FunctionExtension = {
  idEnvironmentVariableName: 'FUNCTION_A_2_ID',
  localIdentifier: 'FUNCTION_A_2',
  configurationPath: '/function/shopify.function.extension.toml',
  directory: '/function',
  type: 'product_discounts',
  graphQLType: 'PRODUCT_DISCOUNTS',
  configuration: {
    name: 'FUNCTION A 2',
    type: 'product_discounts',
    description: 'Function',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configurationUi: false,
    apiVersion: '2022-07',
  },
  buildCommand: 'make build',
  buildWasmPath: '/function/dist/index.wasm',
  inputQueryPath: '/function/input.graphql',
  isJavaScript: false,
  externalType: 'function',
  usingExtensionsFramework: false,
  publishURL: (_) => Promise.resolve(''),
}

const FUNCTION_B: FunctionExtension = {
  idEnvironmentVariableName: 'FUNCTION_B_ID',
  localIdentifier: 'FUNCTION_B',
  configurationPath: '/function/shopify.function.extension.toml',
  directory: '/function',
  type: 'product_discounts',
  graphQLType: 'PRODUCT_DISCOUNTS',
  configuration: {
    name: 'FUNCTION B',
    type: 'product_discounts',
    description: 'Function',
    build: {
      command: 'make build',
      path: 'dist/index.wasm',
    },
    configurationUi: false,
    apiVersion: '2022-07',
  },
  buildCommand: 'make build',
  buildWasmPath: '/function/dist/index.wasm',
  inputQueryPath: '/function/input.graphql',
  isJavaScript: false,
  externalType: 'function',
  usingExtensionsFramework: false,
  publishURL: (_) => Promise.resolve(''),
}

const LOCAL_APP = (functionExtensions: FunctionExtension[]): AppInterface => {
  return testApp({
    name: 'my-app',
    directory: '/app',
    configurationPath: '/shopify.app.toml',
    configuration: {scopes: 'read_products', extensionDirectories: ['extensions/*']},
    extensions: {ui: [], theme: [], function: functionExtensions},
  })
}

const options = (functionExtensions: FunctionExtension[], identifiers: any = {}) => {
  return {
    app: LOCAL_APP(functionExtensions),
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
  }
})
vi.mock('./id-matching')
vi.mock('./id-manual-matching')

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

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(ok({}))
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
        FUNCTION_B: 'ID_B',
      }),
    )
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending confirmation', () => {
  test('do not confirms the pending ones and fails', async () => {
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

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_B]), [REGISTRATION_B])

    // Then
    expect(got).toEqual(err('user-cancelled'))
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

    // When
    await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(deployConfirmationPrompt).toBeCalledWith({
      question: 'Make the following changes to your functions in Shopify Partners?',
      identifiers: {
        FUNCTION_A: 'ID_A',
        FUNCTION_A_2: 'ID_A_2',
      },
      onlyRemote: [],
      toCreate: [],
      dashboardOnly: [],
    })
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
