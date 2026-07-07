/* eslint-disable @shopify/prefer-module-scope-constants */
import {automaticMatchmaking} from './id-matching.js'
import {RemoteSource} from './identifiers.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {testDeveloperPlatformClient, testFunctionExtension, testUIExtension} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test, beforeAll} from 'vitest'
import {outputInfo} from '@shopify/cli-kit/node/output'

vi.mock('../dev/fetch')
vi.mock('../dev/create-extension')
vi.mock('@shopify/cli-kit/node/output')

const REGISTRATION_A: RemoteSource = {
  uuid: 'UUID_A',
  id: 'A',
  title: 'EXTENSION_A',
  type: 'checkout_post_purchase',
}

const REGISTRATION_A_2: RemoteSource = {
  uuid: 'UUID_A_2',
  id: 'A_2',
  title: 'EXTENSION_A_2',
  type: 'checkout_post_purchase',
}

const REGISTRATION_A_3: RemoteSource = {
  uuid: 'UUID_A_3',
  id: 'A_3',
  title: 'EXTENSION_A_3',
  type: 'checkout_post_purchase',
}

const REGISTRATION_A_4: RemoteSource = {
  uuid: 'UUID_A_4',
  id: 'A_4',
  title: 'EXTENSION_A_4',
  type: 'checkout_post_purchase',
}

const REGISTRATION_B: RemoteSource = {
  uuid: 'UUID_B',
  id: 'B',
  title: 'EXTENSION_B',
  type: 'subscription_management',
}

const REGISTRATION_C: RemoteSource = {
  uuid: 'UUID_C',
  id: 'C',
  title: 'EXTENSION_C',
  type: 'theme_app_extension',
}

const REGISTRATION_D: RemoteSource = {
  uuid: 'UUID_D',
  id: 'D',
  title: 'EXTENSION_D',
  type: 'web_pixel_extension',
}

// Same as REGISTRATION_D but with a different type using external_identifier
const REGISTRATION_D_WITH_EXTERNAL_ID: RemoteSource = {
  uuid: 'UUID_D',
  id: 'D',
  title: 'EXTENSION_D',
  type: 'web_pixel_extension_external',
}

const REGISTRATION_FUNCTION_A: RemoteSource = {
  uuid: 'FUNCTION_UUID_A',
  id: 'FUNCTION_A',
  title: 'FUNCTION A',
  type: 'function',
  draftVersion: {
    config: JSON.stringify({
      legacy_function_id: 'LEGACY_FUNCTION_ULID_A',
      legacy_function_uuid: 'LEGACY_FUNCTION_UUID_A',
    }),
  },
}

let EXTENSION_A: ExtensionInstance
let EXTENSION_A_2: ExtensionInstance
let EXTENSION_B: ExtensionInstance
let EXTENSION_B_2: ExtensionInstance
let EXTENSION_C: ExtensionInstance
let EXTENSION_D: ExtensionInstance
let FUNCTION_A: ExtensionInstance

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
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UUID_A',
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
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UIUD_A_2',
  })

  EXTENSION_B = await testUIExtension({
    directory: '/EXTENSION_B',
    configuration: {
      name: 'EXTENSION B',
      type: 'product_subscription',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UUID_B',
  })

  EXTENSION_B_2 = await testUIExtension({
    directory: '/EXTENSION_B_2',
    configuration: {
      name: 'EXTENSION B 2',
      type: 'product_subscription',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UUID_B_2',
  })

  EXTENSION_C = await testUIExtension({
    directory: '/EXTENSION_C',
    configuration: {
      name: 'EXTENSION C',
      type: 'theme',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UUID_C',
  })

  EXTENSION_D = await testUIExtension({
    directory: '/EXTENSION_D',
    configuration: {
      name: 'EXTENSION D',
      type: 'web_pixel_extension',
      metafields: [],
      capabilities: {
        network_access: false,
        block_progress: false,
        api_access: false,
        collect_buyer_consent: {
          sms_marketing: false,
          customer_privacy: false,
        },
        iframe: {
          sources: [],
        },
      },
    },
    outputPath: '',
    entrySourceFilePath: '',
    devUUID: 'devUUID',
    uid: 'UUID_D',
  })

  FUNCTION_A = await testFunctionExtension({
    dir: '/FUNCTION_A',
    config: {
      name: 'FUNCTION A',
      type: 'function',
      description: 'Function',
      build: {
        command: 'make build',
        path: 'dist/index.wasm',
        wasm_opt: true,
      },
      configuration_ui: false,
      api_version: '2022-07',
    },
  })
})

describe('automaticMatchmaking', () => {
  test('creates all local extensions when there are no remote ones', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [], {}, testDeveloperPlatformClient({}))

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })

  test('creates the missing extension when there is a remote one', async () => {
    // When
    const registrationA = {...REGISTRATION_A, id: ''}
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2],
      [registrationA],
      {'extension-a': 'UUID_A'},
      testDeveloperPlatformClient({}),
    )

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A'},
      toConfirm: [],
      toCreate: [EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    }

    expect(got).toEqual(expected)
  })
})

describe('outputAddedIDs', () => {
  test('prints extension IDs when extensions are matched without UID', async () => {
    // Clear any previous mock calls
    vi.mocked(outputInfo).mockClear()

    // Extension B has a valid UID
    // Extension C is marked as toCreate because we only try to match by UID (because it has a real one)
    const registrationA = {...REGISTRATION_A, id: ''}
    const registrationB = {...REGISTRATION_B, id: EXTENSION_B.uid}
    const registrationC = {...REGISTRATION_C}
    const registrationD = {...REGISTRATION_D, id: ''}

    // When: Extensions are matched by UUID (not by UID)
    const result = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B, EXTENSION_C, EXTENSION_D],
      [registrationA, registrationB, registrationC, registrationD],
      {
        'extension-a': 'UUID_A',
        'extension-b': 'UUID_B',
        'extension-c': 'UUID_C',
        'extension-d': 'UUID_D',
      },
      testDeveloperPlatformClient({}),
    )

    // Then: outputInfo should be called with the expected messages
    expect(outputInfo).toHaveBeenCalledWith('Generating extension IDs\n')
    expect(outputInfo).toHaveBeenCalledWith(expect.stringContaining('\x1B[36mextension-a\x1B[39m | Added ID: UUID_A'))
    expect(outputInfo).not.toHaveBeenCalledWith(expect.stringContaining('Added ID: UUID_B'))
    expect(outputInfo).not.toHaveBeenCalledWith(expect.stringContaining('Added ID: UUID_C'))
    expect(outputInfo).toHaveBeenCalledWith(expect.stringContaining('\x1B[35mextension-d\x1B[39m | Added ID: UUID_D'))
    expect(outputInfo).toHaveBeenCalledWith('\n')

    // Verify it was called 4 times total (header + 2 extensions + footer)
    expect(outputInfo).toHaveBeenCalledTimes(4)

    expect(result.toCreate).toEqual([EXTENSION_C])
  })
})
