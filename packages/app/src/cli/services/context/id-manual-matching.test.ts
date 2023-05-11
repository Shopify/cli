import {manualMatchIds, ManualMatchResult} from './id-manual-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {UIExtension} from '../../models/app/extensions.js'
import {describe, expect, vi, test} from 'vitest'
import {ok} from '@shopify/cli-kit/node/result'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

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
  publishURL: (_) => Promise.resolve(''),
  surface: 'surface',
  validate: () => Promise.resolve({} as any),
  preDeployValidation: () => Promise.resolve(),
  buildValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
  isPreviewable: true,
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
  buildValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
  isPreviewable: true,
}

const EXTENSION_B: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_B_ID',
  localIdentifier: 'EXTENSION_B',
  configurationPath: '',
  directory: '',
  type: 'product_subscription',
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
  buildValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
  isPreviewable: true,
}

describe('manualMatch: when all sources are matched', () => {
  test('returns IDs', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('UUID_A')
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('UUID_A_2')

    // When
    const got = await manualMatchIds(
      {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'uuid',
    )

    // Then
    const expected: ManualMatchResult = {
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
      onlyRemote: [],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when there are more local sources', () => {
  test('returns IDs and some sources pending creation', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('UUID_A')

    // When
    const got = await manualMatchIds({local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A]}, 'uuid')

    // Then
    const expected: ManualMatchResult = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toCreate: [EXTENSION_A_2],
      onlyRemote: [],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when there are more local sources and user selects to create', () => {
  test('returns IDs and some sources pending creation', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('UUID_A')
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('create')
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('UUID_A_2')

    // When
    const got = await manualMatchIds(
      {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
      'uuid',
    )

    // Then
    const expected: ManualMatchResult = {
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_A_2'},
      toCreate: [EXTENSION_A_2],
      onlyRemote: [],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when not all remote sources are matched', () => {
  test('returns matched IDs and only remote sources', async () => {
    // Given
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('create')
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('create')
    vi.mocked(renderAutocompletePrompt).mockResolvedValueOnce('create')

    // When
    const got = await manualMatchIds(
      {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
      'uuid',
    )

    // Then
    const expected: ManualMatchResult = {
      identifiers: {},
      toCreate: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
      onlyRemote: [REGISTRATION_A, REGISTRATION_A_2],
    }
    expect(got).toEqual(expected)
  })
})
