/* eslint-disable @shopify/prefer-module-scope-constants */
import {automaticMatchmaking} from './id-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {testFunctionExtension, testUIExtension} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test, beforeAll} from 'vitest'

vi.mock('../dev/fetch')
vi.mock('../dev/create-extension')

const REGISTRATION_A: ExtensionRegistration = {
  uuid: 'UUID_A',
  id: 'A',
  title: 'EXTENSION_A',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_A_2 = {
  uuid: 'UUID_A_2',
  id: 'A_2',
  title: 'EXTENSION_A_2',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_A_3 = {
  uuid: 'UUID_A_3',
  id: 'A_3',
  title: 'EXTENSION_A_3',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_A_4 = {
  uuid: 'UUID_A_4',
  id: 'A_4',
  title: 'EXTENSION_A_4',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_B = {
  uuid: 'UUID_B',
  id: 'B',
  title: 'EXTENSION_B',
  type: 'SUBSCRIPTION_MANAGEMENT',
}

const REGISTRATION_C = {
  uuid: 'UUID_C',
  id: 'C',
  title: 'EXTENSION_C',
  type: 'THEME_APP_EXTENSION',
}

const REGISTRATION_D = {
  uuid: 'UUID_D',
  id: 'D',
  title: 'EXTENSION_D',
  type: 'WEB_PIXEL_EXTENSION',
}

const REGISTRATION_FUNCTION_A = {
  uuid: 'FUNCTION_UUID_A',
  id: 'FUNCTION_A',
  title: 'FUNCTION A',
  type: 'FUNCTION',
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
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
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
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
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
      },
    },
    entrySourceFilePath: '',
    devUUID: 'devUUID',
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
      },
    },
    outputPath: '',
    entrySourceFilePath: '',
    devUUID: 'devUUID',
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
      },
      configuration_ui: false,
      api_version: '2022-07',
      metafields: [],
    },
  })
})

describe('automaticMatchmaking: some local, no remote ones', () => {
  test('creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, no remote ones', () => {
  test('creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, only one remote', () => {
  test('creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A], {}, 'uuid')

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

describe('automaticMatchmaking: some local of the same type, a remote with same type but a remote name that doesnt match a local handle', () => {
  test('prompts for manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, one matching remote and one not matching', () => {
  test('prompts for manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A'},
      toConfirm: [{local: EXTENSION_A_2, remote: REGISTRATION_A_3}],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, two remotes that do not match', () => {
  test('prompts for manual matching', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2],
      [REGISTRATION_A_3, REGISTRATION_A_4],
      {},
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3, REGISTRATION_A_4]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: two pairs of local and only one pair of remote but with diff names', () => {
  test('creates one pair, adds the other to manual match', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B, EXTENSION_B_2],
      [REGISTRATION_A_3, REGISTRATION_A_4],
      {},
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_B, EXTENSION_B_2],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3, REGISTRATION_A_4]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: same number of local and remote with matching types', () => {
  test('matches them automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A', 'extension-b': 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more local than remote, all remote match some local', () => {
  test('matches some and will create the rest', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B, EXTENSION_C, EXTENSION_D],
      [REGISTRATION_A, REGISTRATION_B],
      {},
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A', 'extension-b': 'UUID_B'},
      toConfirm: [],
      toCreate: [EXTENSION_C, EXTENSION_D],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: remote have types not present locally', () => {
  test('create local ones but remind we have unmatched remote', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_C, REGISTRATION_D], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_B],
      toManualMatch: {local: [], remote: [REGISTRATION_C, REGISTRATION_D]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some sources match, but other are missing', () => {
  test('matches when possible and leave rest to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_C], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A'},
      toConfirm: [],
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [], remote: [REGISTRATION_C]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: multiple sources of the same type locally and remotely', () => {
  test('matches automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {
        'extension-a': 'UUID_A',
        'extension-a-2': 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: multiple sources of the same type locally and remotely, others can be matched', () => {
  test('matches automatically and creates new one', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
      [REGISTRATION_A, REGISTRATION_A_2],
      {},
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {
        'extension-a': 'UUID_A',
        'extension-a-2': 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more remote of the same type than local', () => {
  test('matches one and leaves to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: [REGISTRATION_A_2]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more remote of the same type than local, but none matching', () => {
  test('leaves to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A_2, REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A],
      toManualMatch: {local: [], remote: [REGISTRATION_A_2, REGISTRATION_A_3]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more remote of different types than local', () => {
  test('matches one and leaves to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: [REGISTRATION_B]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some sources have uuid, others can be matched', () => {
  test('matches automatically', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B],
      [REGISTRATION_A, REGISTRATION_B],
      {
        EXTENSION_A: 'UUID_A',
      },
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A', 'extension-b': 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe("automaticMatchmaking: some sources have uuid, but doesn't match a remote one", () => {
  test('matches to the correct UUID', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B],
      [REGISTRATION_A, REGISTRATION_B],
      {
        EXTENSION_A: 'UUID_WRONG',
      },
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A', 'extension-b': 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: duplicated sources types but some of them already matched', () => {
  test('matches the other extensions', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
      [REGISTRATION_A, REGISTRATION_A_2, REGISTRATION_B],
      {
        EXTENSION_A: 'UUID_A',
      },
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {'extension-a': 'UUID_A', 'extension-a-2': 'UUID_A_2', 'extension-b': 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: automatic matches with different names', () => {
  test('matches pending confirmation', async () => {
    // When
    const registrationNewA = {...REGISTRATION_A, title: 'A_NEW'}
    const registrationNewB = {...REGISTRATION_B, title: 'B_NEW'}
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [registrationNewA, registrationNewB], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [
        {local: EXTENSION_A, remote: registrationNewA},
        {local: EXTENSION_B, remote: registrationNewB},
      ],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: if identifiers contains something else', () => {
  test('is ignored', async () => {
    // When
    const got = await automaticMatchmaking([], [], {FUNCTION_A: 'FUNCTION_A'}, 'uuid')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: functions', () => {
  test('creates all local functions', async () => {
    // When
    const got = await automaticMatchmaking([FUNCTION_A], [], {}, 'id')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [FUNCTION_A],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: migrates functions with legacy IDs to extension IDs', () => {
  test('updates function when using legacy ID and value exists on remote', async () => {
    // When
    const got = await automaticMatchmaking(
      [FUNCTION_A],
      [REGISTRATION_FUNCTION_A],
      {'function-a': 'LEGACY_FUNCTION_ULID_A'},
      'id',
    )

    // Then
    const expected = {
      identifiers: {'function-a': 'FUNCTION_UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }

    expect(got).toEqual(expected)
  })

  test('updates function when using legacy UUID and value exists on remote', async () => {
    // When
    const got = await automaticMatchmaking(
      [FUNCTION_A],
      [REGISTRATION_FUNCTION_A],
      {'function-a': 'LEGACY_FUNCTION_UUID_A'},
      'id',
    )

    // Then
    const expected = {
      identifiers: {'function-a': 'FUNCTION_UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }

    expect(got).toEqual(expected)
  })

  test('creates local function when it does not exist on remote', async () => {
    // When
    const got = await automaticMatchmaking([FUNCTION_A], [], {}, 'id')

    // Then
    const expected = {
      identifiers: {},
      toConfirm: [],
      toCreate: [FUNCTION_A],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})
