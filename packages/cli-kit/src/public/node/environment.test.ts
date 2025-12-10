import {blockPartnersAccess} from './environment.js'
import {describe, expect, test, beforeEach, afterEach} from 'vitest'

describe('blockPartnersAccess', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {...originalEnv}
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('returns true when SHOPIFY_CLI_NEVER_USE_PARTNERS_API is set', () => {
    // Given
    process.env.SHOPIFY_CLI_NEVER_USE_PARTNERS_API = '1'

    // When
    const result = blockPartnersAccess()

    // Then
    expect(result).toBe(true)
  })

  test('returns false when SHOPIFY_CLI_USE_PARTNERS_API is set', () => {
    // Given
    process.env.SHOPIFY_CLI_USE_PARTNERS_API = '1'

    // When
    const result = blockPartnersAccess()

    // Then
    expect(result).toBe(false)
  })

  test('returns false when forceUsePartnersApi is true regardless of environment variables', () => {
    // Given
    process.env.SHOPIFY_CLI_NEVER_USE_PARTNERS_API = '1'

    // When
    const result = blockPartnersAccess(true)

    // Then
    expect(result).toBe(false)
  })

  test('returns false when forceUsePartnersApi is true even without env vars', () => {
    // Given
    // No environment variables set

    // When
    const result = blockPartnersAccess(true)

    // Then
    expect(result).toBe(false)
  })

  test('returns true for 3P devs (without SHOPIFY_CLI_1P_DEV)', () => {
    // Given
    // SHOPIFY_CLI_1P_DEV is not set

    // When
    const result = blockPartnersAccess()

    // Then
    expect(result).toBe(true)
  })

  test('returns false for 1P devs (with SHOPIFY_CLI_1P_DEV)', () => {
    // Given
    process.env.SHOPIFY_CLI_1P_DEV = '1'

    // When
    const result = blockPartnersAccess()

    // Then
    expect(result).toBe(false)
  })

  test('respects forceUsePartnersApi even for 3P devs', () => {
    // Given
    // SHOPIFY_CLI_1P_DEV is not set (3P dev)

    // When
    const result = blockPartnersAccess(true)

    // Then
    expect(result).toBe(false)
  })

  test('SHOPIFY_CLI_USE_PARTNERS_API takes precedence over SHOPIFY_CLI_NEVER_USE_PARTNERS_API', () => {
    // Given - both environment variables are set
    process.env.SHOPIFY_CLI_NEVER_USE_PARTNERS_API = '1'
    process.env.SHOPIFY_CLI_USE_PARTNERS_API = '1'

    // When
    const result = blockPartnersAccess()

    // Then - should return false because USE_PARTNERS_API takes precedence
    expect(result).toBe(false)
  })

  test('forceUsePartnersApi takes precedence over all environment variables', () => {
    // Given - all conflicting environment variables are set
    process.env.SHOPIFY_CLI_NEVER_USE_PARTNERS_API = '1'
    process.env.SHOPIFY_CLI_USE_PARTNERS_API = '0'
    // SHOPIFY_CLI_1P_DEV is not set (3P dev)

    // When
    const result = blockPartnersAccess(true)

    // Then - should return false because forceUsePartnersApi takes highest precedence
    expect(result).toBe(false)
  })
})
