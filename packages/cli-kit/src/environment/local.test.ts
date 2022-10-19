import {
  hasGit,
  isDevelopment,
  isShopify,
  isUnitTest,
  analyticsDisabled,
  useDeviceAuth,
  cloudEnvironment,
  macAddress,
} from './local.js'
import {exists as fileExists} from '../file.js'
import {exec} from '../system.js'
import {expect, it, describe, vi, test} from 'vitest'

vi.mock('../file')
vi.mock('../system')

describe('isUnitTest', () => {
  it('returns true when SHOPIFY_UNIT_TEST is truthy', () => {
    // Given
    const env = {SHOPIFY_UNIT_TEST: '1'}

    // When
    const got = isUnitTest(env)

    // Then
    expect(got).toBe(true)
  })
})

describe('isDevelopment', () => {
  it('returns true when SHOPIFY_CLI_ENV is debug', () => {
    // Given
    const env = {SHOPIFY_CLI_ENV: 'development'}

    // When
    const got = isDevelopment(env)

    // Then
    expect(got).toBe(true)
  })
})

describe('isShopify', () => {
  it('returns false when the SHOPIFY_RUN_AS_USER env. variable is truthy', async () => {
    // Given
    const env = {SHOPIFY_RUN_AS_USER: '1'}

    // When
    await expect(isShopify(env)).resolves.toEqual(false)
  })

  it('returns true when the SHOPIFY_RUN_AS_USER env. variable is falsy', async () => {
    // Given
    const env = {SHOPIFY_RUN_AS_USER: '0'}

    // When
    await expect(isShopify(env)).resolves.toEqual(true)
  })

  it('returns true when dev is installed', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await expect(isShopify()).resolves.toBe(true)
  })

  it('returns true when it is a spin environment', async () => {
    // Given
    const env = {SPIN: '1'}

    // When
    await expect(isShopify(env)).resolves.toBe(true)
  })
})

describe('hasGit', () => {
  test('returns false if git --version errors', async () => {
    // Given
    vi.mocked(exec).mockRejectedValue(new Error('git not found'))

    // When
    const got = await hasGit()

    // Then
    expect(got).toBeFalsy()
  })

  test('returns true if git --version succeeds', async () => {
    // Given
    vi.mocked(exec).mockResolvedValue(undefined)

    // When
    const got = await hasGit()

    // Then
    expect(got).toBeTruthy()
  })
})

describe('analitycsDisabled', () => {
  it('returns true when SHOPIFY_CLI_NO_ANALYTICS is truthy', () => {
    // Given
    const env = {SHOPIFY_CLI_NO_ANALYTICS: '1'}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns true when in development', () => {
    // Given
    const env = {SHOPIFY_CLI_ENV: 'development'}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns false without env variables', () => {
    // Given
    const env = {}

    // When
    const got = analyticsDisabled(env)

    // Then
    expect(got).toBe(false)
  })
})

describe('useDeviceAuth', () => {
  it('returns true if SHOPIFY_CLI_DEVICE_AUTH is truthy', () => {
    // Given
    const env = {SHOPIFY_CLI_DEVICE_AUTH: '1'}

    // When
    const got = useDeviceAuth(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns true if SPIN is truthy', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = useDeviceAuth(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns true if CODESPACES is truthy', () => {
    // Given
    const env = {CODESPACES: '1'}

    // When
    const got = useDeviceAuth(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns true if GITPOD_WORKSPACE_URL is set', () => {
    // Given
    const env = {GITPOD_WORKSPACE_URL: 'http://custom.gitpod.io'}

    // When
    const got = useDeviceAuth(env)

    // Then
    expect(got).toBe(true)
  })

  it('returns false when SHOPIFY_CLI_DEVICE_AUTH, SPIN, CODESPACES or GITPOD_WORKSPACE_URL are missing', () => {
    // Given
    const env = {}

    // When
    const got = useDeviceAuth(env)

    // Then
    expect(got).toBe(false)
  })
})

describe('macAddress', () => {
  it('returns any mac address value', async () => {
    // When
    const got = await macAddress()

    // Then
    expect(got).not.toBeUndefined()
  })
})

describe('cloudEnvironment', () => {
  it('when spin environmentreturns correct cloud platform', () => {
    // Given
    const env = {SPIN: '1'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('spin')
  })

  it('when codespace environmentreturns correct cloud platform', () => {
    // Given
    const env = {CODESPACES: '1'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('codespaces')
  })

  it('when gitpod environmentreturns correct cloud platform', () => {
    // Given
    const env = {GITPOD_WORKSPACE_URL: 'http://custom.gitpod.io'}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('gitpod')
  })

  it('returns localhost when no cloud enviroment varible exist', () => {
    // Given
    const env = {}

    // When
    const got = cloudEnvironment(env)

    // Then
    expect(got.platform).toBe('localhost')
  })
})
