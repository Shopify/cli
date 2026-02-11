import {testCredentialProvider, configureTestTokens, resetTestTokens} from './credentials.js'
import {describe, test, expect, beforeEach} from 'vitest'

beforeEach(() => {
  resetTestTokens()
})

describe('testCredentialProvider', () => {
  test('returns default test tokens', async () => {
    const provider = testCredentialProvider()

    await expect(provider.getToken('admin')).resolves.toBe('test-admin-token')
    await expect(provider.getToken('partners')).resolves.toBe('test-partners-token')
    await expect(provider.getToken('storefront-renderer')).resolves.toBe('test-storefront-token')
    await expect(provider.getToken('business-platform')).resolves.toBe('test-bp-token')
    await expect(provider.getToken('app-management')).resolves.toBe('test-appmgmt-token')
  })

  test('returns configured override tokens', async () => {
    configureTestTokens({admin: 'custom-admin-token'})

    const provider = testCredentialProvider()
    await expect(provider.getToken('admin')).resolves.toBe('custom-admin-token')
    // Non-overridden tokens still return defaults
    await expect(provider.getToken('partners')).resolves.toBe('test-partners-token')
  })

  test('returns null when audience is overridden with undefined', async () => {
    configureTestTokens({admin: undefined})

    const provider = testCredentialProvider()
    await expect(provider.getToken('admin')).resolves.toBeNull()
  })

  test('resetTestTokens clears overrides', async () => {
    configureTestTokens({admin: 'custom-admin-token'})
    resetTestTokens()

    const provider = testCredentialProvider()
    await expect(provider.getToken('admin')).resolves.toBe('test-admin-token')
  })

  test('configureTestTokens merges with previous overrides', async () => {
    configureTestTokens({admin: 'custom-admin'})
    configureTestTokens({partners: 'custom-partners'})

    const provider = testCredentialProvider()
    await expect(provider.getToken('admin')).resolves.toBe('custom-admin')
    await expect(provider.getToken('partners')).resolves.toBe('custom-partners')
  })

  test('has the name TestStatic', () => {
    const provider = testCredentialProvider()
    expect(provider.name).toBe('TestStatic')
  })
})
