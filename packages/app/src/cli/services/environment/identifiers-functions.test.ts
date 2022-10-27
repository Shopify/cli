import {automaticMatchmaking} from './id-matching.js'
import {manualMatchIds} from './id-manual-matching.js'
import {ensureFunctionsIds} from './identifiers-functions.js'
import {RemoteSource} from './identifiers.js'
import {AppInterface} from '../../models/app/app.js'
import {FunctionExtension} from '../../models/app/extensions.js'
import {testApp} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {err, ok} from '@shopify/cli-kit/common/result'
import {ui} from '@shopify/cli-kit'

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
  metadata: {
    schemaVersions: {},
  },
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
  buildWasmPath: () => '/function/dist/index.wasm',
  inputQueryPath: () => '/function/input.graphql',
}

const FUNCTION_A_2: FunctionExtension = {
  metadata: {
    schemaVersions: {},
  },
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
  buildWasmPath: () => '/function/dist/index.wasm',
  inputQueryPath: () => '/function/input.graphql',
}

const FUNCTION_B: FunctionExtension = {
  metadata: {
    schemaVersions: {},
  },
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
  buildWasmPath: () => '/function/dist/index.wasm',
  inputQueryPath: () => '/function/input.graphql',
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
  vi.mock('./id-matching')
  vi.mock('./id-manual-matching')
})

describe('ensureFunctionsIds: matchmaking returns invalid', () => {
  it('throw an invalid environment error', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(err('invalid-environment'))

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_B]), [REGISTRATION_A, REGISTRATION_B])

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with pending manual matches', () => {
  it('will call manualMatch and merge automatic and manual matches and create missing extensions', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [FUNCTION_A, FUNCTION_A_2, FUNCTION_B],
          remote: [REGISTRATION_A, REGISTRATION_A_2],
        },
      }),
    )

    vi.mocked(manualMatchIds).mockResolvedValueOnce({
      result: 'ok',
      identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
      toCreate: [FUNCTION_B],
    })

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
  it('throws an error for missing remote extension matches', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [FUNCTION_A],
          remote: [REGISTRATION_A, REGISTRATION_A_2],
        },
      }),
    )
    vi.mocked(manualMatchIds).mockResolvedValueOnce({result: 'pending-remote'})

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(err('pending-remote'))
    expect(manualMatchIds).toBeCalledWith({local: [FUNCTION_A], remote: [REGISTRATION_A, REGISTRATION_A_2]}, 'id')
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending to create', () => {
  it('Returns an empty object as functions will be automatically created when deployed', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [],
        toCreate: [FUNCTION_A, FUNCTION_A_2],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_A, FUNCTION_A_2]), [REGISTRATION_A, REGISTRATION_A_2])

    // Then
    expect(got).toEqual(ok({}))
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with some pending confirmation', () => {
  it('confirms the pending ones and suceeds', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'yes'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [{local: FUNCTION_B, remote: REGISTRATION_B}],
        toCreate: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

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
  it('do not confirms the pending ones and fails', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({value: 'no'})
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {},
        toConfirm: [{local: FUNCTION_B, remote: REGISTRATION_B}],
        toCreate: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

    // When
    const got = await ensureFunctionsIds(options([FUNCTION_B]), [REGISTRATION_B])

    // Then
    expect(got).toEqual(err('user-cancelled'))
  })
})

describe('ensureFunctionsIds: matchmaking returns ok with nothing pending', () => {
  it('suceeds and returns all identifiers', async () => {
    // Given
    vi.mocked(automaticMatchmaking).mockResolvedValueOnce(
      ok({
        identifiers: {FUNCTION_A: 'ID_A', FUNCTION_A_2: 'ID_A_2'},
        toCreate: [],
        toConfirm: [],
        toManualMatch: {
          local: [],
          remote: [],
        },
      }),
    )

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
