import {isSpin} from './spin'
import {hasGit, isDebug, isShopify, isUnitTest} from './local'
import {exists as fileExists} from '../file'
import {exec} from '../system'
import {expect, it, describe, vi, test} from 'vitest'

vi.mock('../file')
vi.mock('../system')
vi.mock('./spin', () => ({
  isSpin: vi.fn(),
}))

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

describe('isDebug', () => {
  it('returns true when SHOPIFY_CONFIG is debug', () => {
    // Given
    const env = {SHOPIFY_CONFIG: 'debug'}

    // When
    const got = isDebug(env)

    // Then
    expect(got).toBe(true)
  })
})

describe('isShopify', () => {
  it('returns false when the SHOPIFY_RUN_AS_USER env. variable is truthy', async () => {
    // Given
    const env = {SHOPIFY_RUN_AS_USER: '1'}

    // When
    await expect(isShopify(env)).resolves.toBe(false)
  })

  it('returns true when dev is installed', async () => {
    // Given
    vi.mocked(fileExists).mockResolvedValue(true)

    // When
    await expect(isShopify()).resolves.toBe(true)
  })

  it('returns true when it is a spin environment', async () => {
    // Given
    vi.mocked(isSpin).mockReturnValue(true)

    // When
    await expect(isShopify()).resolves.toBe(true)
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
