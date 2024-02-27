/* eslint-disable @shopify/prefer-module-scope-constants */
import {manualMatchIds, ManualMatchResult} from './id-manual-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {testUIExtension} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, vi, test, beforeAll} from 'vitest'
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

let EXTENSION_A: ExtensionInstance
let EXTENSION_A_2: ExtensionInstance
let EXTENSION_B: ExtensionInstance

beforeAll(async () => {
  EXTENSION_A = await testUIExtension({
    directory: '/EXTENSION_A',
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
          customer_privacy: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_A_2 = await testUIExtension({
    directory: '/EXTENSION_A_2',
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
          customer_privacy: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })

  EXTENSION_B = await testUIExtension({
    directory: '/EXTENSION_B',
    configuration: {
      name: 'EXTENSION B',
      type: 'checkout_post_purchase',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
  })
})

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
      identifiers: {'extension-a': 'UUID_A', 'extension-a-2': 'UUID_A_2'},
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
      identifiers: {'extension-a': 'UUID_A'},
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
      identifiers: {'extension-a': 'UUID_A', 'extension-b': 'UUID_A_2'},
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
