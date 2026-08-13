import {
  AuthSetupError,
  readAuthConfig,
  retryAuthOperation,
  validateRemoteE2EEnvironment,
} from '../setup/auth-diagnostics.js'
import {expect, test} from '@playwright/test'

const validEnvironment = {
  E2E_ACCOUNT_EMAIL: 'e2e@example.com',
  E2E_ACCOUNT_PASSWORD: 'password',
  E2E_ORG_ID: '12345',
  E2E_LOADTEST_HEADER: 'X-Shopify-Loadtest-12345678-1234-1234-1234-123456789abc',
  E2E_STORE_FQDN: 'e2e-store.myshopify.com',
}

test.describe('auth diagnostics', () => {
  test('reports missing configuration by variable name', () => {
    expect(() => readAuthConfig({})).toThrow(
      'stage=configuration reason=missing-E2E_ACCOUNT_EMAIL,E2E_ACCOUNT_PASSWORD,E2E_ORG_ID,E2E_LOADTEST_HEADER',
    )
  })

  test('does not include invalid configuration values in diagnostics', () => {
    const invalidHeader = 'X-Shopify-Loadtest-secret-value'

    expect(() => readAuthConfig({...validEnvironment, E2E_LOADTEST_HEADER: invalidHeader})).toThrow(
      'stage=configuration reason=invalid-loadtest-header',
    )

    try {
      readAuthConfig({...validEnvironment, E2E_LOADTEST_HEADER: invalidHeader})
    } catch (error) {
      if (!(error instanceof AuthSetupError)) throw error
      expect(String(error)).not.toContain(invalidHeader)
    }
  })

  test('validates store configuration before remote tests start', () => {
    expect(() => validateRemoteE2EEnvironment({...validEnvironment, E2E_STORE_FQDN: ''})).toThrow(
      'stage=configuration reason=missing-E2E_STORE_FQDN',
    )
  })

  test('retries transient authentication failures once', async () => {
    let attempts = 0

    const result = await retryAuthOperation(
      async () => {
        attempts++
        if (attempts === 1) throw new AuthSetupError('device-code-generation', 'timeout')
        return 'authenticated'
      },
      {delayMs: 0},
    )

    expect(result).toBe('authenticated')
    expect(attempts).toBe(2)
  })

  test('marks only device login and page-load failures as retryable', () => {
    expect(new AuthSetupError('device-code-generation', 'timeout').retryable).toBe(true)
    expect(new AuthSetupError('browser-login', 'page-load').retryable).toBe(true)
    expect(new AuthSetupError('session-prewarm', 'admin-page-load').retryable).toBe(true)
    expect(new AuthSetupError('browser-login', 'login-form').retryable).toBe(false)
  })

  test('does not retry deterministic authentication failures', async () => {
    let attempts = 0

    await expect(
      retryAuthOperation(
        async () => {
          attempts++
          throw new AuthSetupError('browser-login', 'login-form')
        },
        {delayMs: 0},
      ),
    ).rejects.toThrow('stage=browser-login reason=login-form')
    expect(attempts).toBe(1)
  })
})
