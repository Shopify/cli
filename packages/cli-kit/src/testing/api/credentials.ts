/**
 * Test utilities for the credential provider system.
 *
 * These utilities allow tests to inject fake credentials without module-level
 * vi.mock() calls. Use `testCredentialProvider()` to create a static provider,
 * and `configureTestTokens()` / `resetTestTokens()` to override tokens per-test.
 *
 * @example
 * ```typescript
 * import {testCredentialProvider, configureTestTokens, resetTestTokens} from '@shopify/cli-kit/testing/api/credentials'
 *
 * beforeEach(() => {
 *   resetTestTokens()
 * })
 *
 * test('uses admin token', async () => {
 *   configureTestTokens({admin: 'my-test-admin-token'})
 *   const provider = testCredentialProvider()
 *   const token = await provider.getToken('admin')
 *   expect(token).toBe('my-test-admin-token')
 * })
 * ```
 */

import type {ApiAudience, CredentialProvider} from '../../public/node/api/auth/credential-provider.js'

const defaultTestTokens: {[key in ApiAudience]: string} = {
  admin: 'test-admin-token',
  partners: 'test-partners-token',
  'storefront-renderer': 'test-storefront-token',
  'business-platform': 'test-bp-token',
  'app-management': 'test-appmgmt-token',
}

let overrides: {[key in ApiAudience]?: string | undefined} = {}

/**
 * Override tokens for the current test.
 * Set a value to `undefined` to make that audience return `null`.
 *
 * @param tokens - A map of audience to token value.
 */
export function configureTestTokens(tokens: {[key in ApiAudience]?: string | undefined}): void {
  overrides = {...overrides, ...tokens}
}

/**
 * Reset to defaults. Call in afterEach or beforeEach.
 */
export function resetTestTokens(): void {
  overrides = {}
}

/**
 * Creates a credential provider that returns static test tokens.
 * Tokens can be configured via `configureTestTokens()`.
 *
 * @returns A CredentialProvider for testing.
 */
export function testCredentialProvider(): CredentialProvider {
  return {
    name: 'TestStatic',
    async getToken(audience: ApiAudience): Promise<string | null> {
      if (audience in overrides) {
        return overrides[audience] ?? null
      }
      return defaultTestTokens[audience] ?? `test-${audience}-token`
    },
  }
}
