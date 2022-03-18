import {expect, it, describe, vi} from 'vitest'

import {exists as fileExists} from '../file'

import {isSpin} from './spin'
import {isDebug, isShopify} from './local'

vi.mock('../file')
vi.mock('./spin')

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
    vi.mocked(isSpin).mockResolvedValue(true)

    // When
    await expect(isShopify()).resolves.toBe(true)
  })
})
