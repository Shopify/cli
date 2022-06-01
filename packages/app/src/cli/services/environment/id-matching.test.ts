import {automaticMatchmaking, MatchResult} from './id-matching'
import {ExtensionRegistration} from '../dev/create-extension'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {UIExtension} from 'cli/models/app/app'

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
  title: 'A',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_A_2 = {
  uuid: 'UUID_A_2',
  id: 'A_2',
  title: 'A_2',
  type: 'CHECKOUT_POST_PURCHASE',
}

const REGISTRATION_B = {
  uuid: 'UUID_B',
  id: 'B',
  title: 'B',
  type: 'SUBSCRIPTION_MANAGEMENT',
}

const REGISTRATION_C = {
  uuid: 'UUID_C',
  id: 'C',
  title: 'C',
  type: 'THEME_APP_EXTENSION',
}

const REGISTRATION_D = {
  uuid: 'UUID_D',
  id: 'D',
  title: 'D',
  type: 'BEACON_EXTENSION',
}

const EXTENSION_A: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_ID',
  localIdentifier: 'EXTENSION_A',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
}

const EXTENSION_A_2: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_A_2_ID',
  localIdentifier: 'EXTENSION_A_2',
  configurationPath: '',
  directory: '',
  type: 'checkout_post_purchase',
  graphQLType: 'CHECKOUT_POST_PURCHASE',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
}

const EXTENSION_B: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_B_ID',
  localIdentifier: 'EXTENSION_B',
  configurationPath: '',
  directory: '',
  type: 'product_subscription',
  graphQLType: 'SUBSCRIPTION_MANAGEMENT',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
}

const EXTENSION_C: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_C_ID',
  localIdentifier: 'EXTENSION_C',
  configurationPath: '',
  directory: '',
  type: 'theme',
  graphQLType: 'THEME_APP_EXTENSION',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
}

const EXTENSION_D: UIExtension = {
  idEnvironmentVariableName: 'EXTENSION_D_ID',
  localIdentifier: 'EXTENSION_D',
  configurationPath: '',
  directory: '',
  type: 'beacon_extension',
  graphQLType: 'BEACON_EXTENSION',
  configuration: {name: '', type: 'checkout_post_purchase', metafields: []},
  buildDirectory: '',
  entrySourceFilePath: '',
}

describe('automaticMatchmaking: case 3 some local extensions, no remote ones', () => {
  it('success and creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [], {})

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {},
      toCreate: [EXTENSION_A, EXTENSION_B],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 3b some local extensions of the same type, no remote ones', () => {
  it('success and creates all local extensions', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [], {})

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {},
      toCreate: [EXTENSION_A, EXTENSION_A_2],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 4 same number of extensions local and remote with matching types', () => {
  it('suceeds automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {})

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
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
    )

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toCreate: [EXTENSION_C, EXTENSION_D],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 6 remote extensions have types not present locally', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_C, REGISTRATION_D], {})

    // Then
    expect(got).toEqual({result: 'invalid-environment'})
  })
})

describe('automaticMatchmaking: case 7 some extensions match, but other are missing', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_C], {})

    // Then
    expect(got).toEqual({result: 'invalid-environment'})
  })
})

describe('automaticMatchmaking: case 8 multiple extensions of the same type locally and remotely', () => {
  it('success and returns extensions pending manual match', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_A_2], [REGISTRATION_A, REGISTRATION_A_2], {})

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {},
      toCreate: [],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
    }
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
    )

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {},
      toCreate: [EXTENSION_B],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
    }
    expect(got).toEqual(expected)
  })
})

describe('automaticMatchmaking: case 10 there are more remote than local extensions', () => {
  it('throw error, invalid local environment', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A], [REGISTRATION_A, REGISTRATION_A_2], {})

    // Then
    expect(got).toEqual({result: 'invalid-environment'})
  })
})

describe('automaticMatchmaking: case 11 some extension have uuid, others can be matched', () => {
  it('suceeds automatically', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {
      EXTENSION_A: 'UUID_A',
    })

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
    expect(got).toEqual(expected)
  })
})

describe("automaticMatchmaking: case 12 some extension have uuid, but doesn't match a remote one", () => {
  it('suceeds rematching the extension to the correct UUID if the type is valid', async () => {
    // When
    const got = await automaticMatchmaking([EXTENSION_A, EXTENSION_B], [REGISTRATION_A, REGISTRATION_B], {
      EXTENSION_A: 'UUID_WRONG',
    })

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_B: 'UUID_B'},
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
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
    )

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_A: 'UUID_A', EXTENSION_A_2: 'UUID_A_2', EXTENSION_B: 'UUID_B'},
      toCreate: [],
      toManualMatch: {local: [], remote: []},
    }
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
    )

    // Then
    const expected: MatchResult = {
      result: 'ok',
      identifiers: {EXTENSION_D: 'UUID_D', EXTENSION_B: 'UUID_B'},
      toCreate: [EXTENSION_C],
      toManualMatch: {local: [EXTENSION_A, EXTENSION_A_2], remote: [REGISTRATION_A, REGISTRATION_A_2]},
    }
    expect(got).toEqual(expected)
  })
})
