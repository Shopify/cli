import {automaticMatchmaking} from './id-matching.js'
import {ExtensionRegistration} from '../dev/create-extension.js'
import {UIExtension} from '../../models/app/extensions.js'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ok} from '@shopify/cli-kit/node/result'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

beforeEach(() => {
  vi.mock('@shopify/cli-kit/node/session')
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
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
    capabilities: {network_access: false, block_progress: false, api_access: false},
  },
  outputBundlePath: '',
  entrySourceFilePath: '',
  devUUID: 'devUUID',
  externalType: 'checkout_ui',
  surface: 'surface',
  preDeployValidation: () => Promise.resolve(),
  deployConfig: () => Promise.resolve({}),
  previewMessage: (_) => undefined,
  publishURL: (_) => Promise.resolve(''),
  validate: () => Promise.resolve(ok({})),
  getBundleExtensionStdinContent: () => '',
  shouldFetchCartUrl: () => true,
  hasExtensionPointTarget: (target: string) => true,
}

describe('automaticMatchmaking: some local, no remote ones', () => {
  it('creates all local extensions', async () => {
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
  it('creates all local extensions', async () => {
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
  it('creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [],
      toCreate: [EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, a remote with same type but different name', () => {
  it('prompts for manual matching', async () => {
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
  it('prompts for manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_3], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [{local: EXTENSION_A_2, remote: REGISTRATION_A_3}],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some local of the same type, two remotes that do not match', () => {
  it('prompts for manual matching', async () => {
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
  it('creates one pair, adds the other to manual match', async () => {
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
  it('matches them automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more local than remote, all remote match some local', () => {
  it('matches some and will create the rest', async () => {
    // When
    const got = await automaticMatchmaking(
      [EXTENSION_A, EXTENSION_B, EXTENSION_C, EXTENSION_D],
      [REGISTRATION_A, REGISTRATION_B],
      {},
      'uuid',
    )

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [EXTENSION_C, EXTENSION_D],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: remote have types not present locally', () => {
  it('create local ones but remind we have unmatched remote', async () => {
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
  it('matches when possible and leave rest to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_C], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [],
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [], remote: [REGISTRATION_C]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: multiple sources of the same type locally and remotely', () => {
  it('matches automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: multiple sources of the same type locally and remotely, others can be matched', () => {
  it('matches automatically and creates new one', async () => {
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
        EXTENSION_A: 'UUID_A',
        EXTENSION_A_2: 'UUID_A_2',
      },
      toConfirm: [],
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more remote of the same type than local', () => {
  it('matches one and leaves to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: [REGISTRATION_A_2]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: more remote of the same type than local, but none matching', () => {
  it('leaves to manual matching', async () => {
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
  it('matches one and leaves to manual matching', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_B], {}, 'uuid')

    // Then
    const expected = {
      identifiers: {EXTENSION_A: 'UUID_A'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: [REGISTRATION_B]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: some sources have uuid, others can be matched', () => {
  it('matches automatically', async () => {
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
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe("automaticMatchmaking: some sources have uuid, but doesn't match a remote one", () => {
  it('matches to the correct UUID', async () => {
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
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: duplicated sources types but some of them already matched', () => {
  it('matches the other extensions', async () => {
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
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B'},
      toConfirm: [],
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: automatic matches with different names', () => {
  it('matches pending confirmation', async () => {
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
