import {automaticMatchmaking} from './id-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {UIExtension} from '../../models/app/extensions.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {err, ok} from '@shopify/cli-kit/common/result'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: async () => 'token',
      },
    }
  })
  vi.mock('../dev/fetch')
  vi.mock('../dev/create-extension')
})

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

const REGISTRATION_B_2 = {
  uuid: 'UUID_B_2',
  id: 'B_2',
  title: 'EXTENSION_B_2',
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

const EXTENSION_A: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_ID',
  localIdentifier: 'EXTENSION_A',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {
    name: 'EXTENSION A',
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
    name: 'EXTENSION A 2',
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
  graphQLType: 'SUBSCRIPTION_MANAGEMENT',
  configuration: {
    name: 'EXTENSION B',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_B_2: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_B_2_ID',
  localIdentifier: 'EXTENSION_B_2',
  configurationPath: '',
  directory: '',
  type: 'product_subscription',
  graphQLType: 'SUBSCRIPTION_MANAGEMENT',
  configuration: {
    name: 'EXTENSION B 2',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_C: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_C_ID',
  localIdentifier: 'EXTENSION_C',
  configurationPath: '',
  directory: '',
  type: 'theme',
  graphQLType: 'THEME_APP_EXTENSION',
  configuration: {
    name: 'EXTENSION C',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

const EXTENSION_D: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_D_ID',
  localIdentifier: 'EXTENSION_D',
  configurationPath: '',
  directory: '',
  type: 'web_pixel_extension',
  graphQLType: 'WEB_PIXEL_EXTENSION',
  configuration: {
    name: 'EXTENSION D',
    type: 'checkout_post_purchase',
    metafields: [],
    capabilities: {network_access: false, block_progress: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
}

describe('automaticMatchmaking: case 3 some local extensions, no remote ones', () => {
  it('success and creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3b some local extensions of the same type, no remote ones', () => {
  it('success and creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_A, EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3c some local extensions of the same type, only one remote', () => {
  it('success and creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [],
      toCreate: [EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3d some local extensions of the same type, a remote with same type but different name', () => {
  it('success and prompts for confirmation', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3]},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3e some local extensions of the same type, one matching remote and one not matching', () => {
  it('success and prompts for confirmation', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [{local: EXTENSION_A_2, remote: REGISTRATION_A_3}],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3f some local extensions of the same type, two remotes that do not match', () => {
  it('success and prompts for confirmation', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2],
      [REGISTRATION_A_3, REGISTRATION_A_4],
      {},
      'uuid',
    )

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3, REGISTRATION_A_4]},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3g two pairs of local extensions and only 1 pair of remote but with diff names', () => {
  it('success and creates 1 pair of local extensions, adds the other to manual match', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B, EXTENSION_B_2],
      [REGISTRATION_A_3, REGISTRATION_A_4],
      {},
      'uuid',
    )

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [],
      toCreate: [EXTENSION_B, EXTENSION_B_2],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A_3, REGISTRATION_A_4]},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 4 same number of extensions local and remote with matching types', () => {
  it('suceeds automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 5 more extensions local than remote, all remote match some local', () => {
  it('suceeds and returns extensions pending creation', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B, EXTENSION_C, EXTENSION_D],
      [REGISTRATION_A, REGISTRATION_B],
      {},
      'uuid',
    )

    // Then
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [EXTENSION_C, EXTENSION_D],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 6 remote extensions have types not present locally', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_C, REGISTRATION_D], {}, 'uuid')

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})

describe('automaticMatchmaking: case 7 some extensions match, but other are missing', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_C], {}, 'uuid')

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})

describe('automaticMatchmaking: case 8 multiple extensions of the same type locally and remotely', () => {
  it('success and returns extensions pending manual match', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 9 multiple extensions of the same type locally and remotely, others can be matched', () => {
  it('throw a needs manual match error', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B],
      [REGISTRATION_A, REGISTRATION_A_2],
      {},
      'uuid',
    )

    // Then
    const expected = ok({
      identifiers: {
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 10 there are more remote than local extensions', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})

describe('automaticMatchmaking: case 11 some extension have uuid, others can be matched', () => {
  it('suceeds automatically', async () => {
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
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe("automaticMatchmaking: case 12 some extension have uuid, but doesn't match a remote one", () => {
  it('suceeds rematching the extension to the correct UUID if the type is valid', async () => {
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
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 13 duplicated extension types but some of them already matched', () => {
  it('suceeds matching the other extensions', async () => {
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
    const expected = ok({
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 14 a bit of everything', () => {
  it('suceeds returning automatic matches, including pending creation and manual', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_A_2, EXTENSION_B, EXTENSION_C, EXTENSION_D],
      [REGISTRATION_A, REGISTRATION_A_2, REGISTRATION_B, REGISTRATION_D],
      {
        EXTENSION_D: 'UUID_D',
      },
      'uuid',
    )

    // Then
    const expected = ok({
      identifiers: {
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
        EXTENSION_D: 'UUID_D',
        EXTENSION_B: 'UUID_B',
      },
      toConfirm: [],
      toCreate: [EXTENSION_C],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 15 automatic matches with different names', () => {
  it('suceeds returning matches pending confirmation', async () => {
    // When
    const registrationNewA = {...REGISTRATION_A, title: 'A_NEW'}
    const registrationNewB = {...REGISTRATION_B, title: 'B_NEW'}
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [registrationNewA, registrationNewB], {}, 'uuid')

    // Then
    const expected = ok({
      identifiers: {},
      toConfirm: [
        {local: EXTENSION_A, remote: registrationNewA},
        {local: EXTENSION_B, remote: registrationNewB},
      ],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    })
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 16 more remote than local extensions', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    expect(got).toEqual(err('invalid-environment'))
  })
})
