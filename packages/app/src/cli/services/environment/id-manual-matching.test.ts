import {manualMatchIds, ManualMatchResult} from './id-manual-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {UIExtension} from '../../models/app/extensions.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
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
  type: 'product_subscription',
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

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      ui: {
        prompt: vi.fn(),
      },
    }
  })
})

describe('manualMatch: when all extensions are matched', () => {
  it('suceeds and returns IDs', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'UUID_A'})
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'UUID_A_2'})

    // When
    const got = await manualMatchIds(
      {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
      'uuid',
    )

    // Then
    const expected: ManualMatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2'},
      toCreate: [],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when there are more local extensions', () => {
  it('suceeds and returns IDs and some extensions pending creation', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'UUID_A'})

    // When
    const got = await manualMatchIds({local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A]}, 'uuid')

    // Then
    const expected: ManualMatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A'},
      toCreate: [EXTENSION_A_2],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when there are more local extensions and user selects to create', () => {
  it('suceeds and returns IDs and some extensions pending creation', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'UUID_A'})
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'create'})
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'UUID_A_2'})

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
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_A_2'},
      toCreate: [EXTENSION_A_2],
    }
    expect(got).toEqual(expected)
  })
})

describe('manualMatch: when not all remote extensions are matched', () => {
  it('returns a pending-remote error', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'create'})
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'create'})
    vi.mocked(ui.prompt).mockResolvedValueOnce({uuid: 'create'})

    // When
    const got = await manualMatchIds(
      {
        local: [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
        remote: [REGISTRATION_A, REGISTRATION_A_2],
      },
      'uuid',
    )

    // Then
    const expected: ManualMatchResult = {result: 'pending-remote'}
    expect(got).toEqual(expected)
  })
})
