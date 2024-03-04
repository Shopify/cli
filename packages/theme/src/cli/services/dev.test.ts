import {showDeprecationWarnings, refreshTokens, dev} from './dev.js'
import {describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

vi.mock('@shopify/cli-kit/node/ruby')

describe('dev', () => {
  const adminSession = {storeFqdn: 'my-store.myshopify.com', token: 'my-token'}
  const options = {
    adminSession,
    storefrontToken: 'my-storefront-token',
    directory: 'my-directory',
    store: 'my-store',
    theme: '123',
    force: false,
    open: false,
    flagsToPass: [],
    password: 'my-token',
  }

  test('runs theme serve on CLI2 without passing a token when no password is used', async () => {
    // Given
    const devOptions = {...options, password: undefined}

    // When
    await dev(devOptions)

    // Then
    const expectedParams = ['theme', 'serve', 'my-directory']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
      store: 'my-store',
      adminToken: undefined,
      storefrontToken: undefined,
    })
  })

  test('runs theme serve on CLI2 passing a token when a password is used', async () => {
    // Given
    const devOptions = {...options, password: 'my-token'}

    // When
    await dev(devOptions)

    // Then
    const expectedParams = ['theme', 'serve', 'my-directory']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
      store: 'my-store',
      adminToken: 'my-token',
      storefrontToken: 'my-storefront-token',
    })
  })

  test("runs theme serve on CLI2 passing '--open' flag when it's true", async () => {
    // Given
    const devOptions = {...options, open: true}

    // When
    await dev(devOptions)

    // Then
    const expectedParams = ['theme', 'serve', 'my-directory', '--open']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
      store: 'my-store',
      adminToken: 'my-token',
      storefrontToken: 'my-storefront-token',
    })
  })

  test("runs theme serve on CLI2 passing '--open' flag when it's false", async () => {
    // Given
    const devOptions = {...options, open: false}

    // When
    await dev(devOptions)

    // Then
    const expectedParams = ['theme', 'serve', 'my-directory']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams, {
      store: 'my-store',
      adminToken: 'my-token',
      storefrontToken: 'my-storefront-token',
    })
  })
})

describe('showDeprecationWarnings', () => {
  test('does nothing when the -e flag includes a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', 'whatever'])

    // Then
    expect(outputMock.output()).toMatch('')
  })

  test('shows a warning message when the -e flag does not include a value', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })

  test('shows a warning message when the -e flag is followed by another flag', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    showDeprecationWarnings(['-e', '--verbose'])

    // Then
    expect(outputMock.output()).toMatch(/reserved for environments/)
  })
})

describe('refreshTokens', () => {
  test('returns the admin session and storefront token', async () => {
    // When
    const result = await refreshTokens('my-store', 'my-password')

    // Then
    expect(result).toEqual({
      adminSession: {storeFqdn: 'my-store.myshopify.com', token: 'my-password'},
      storefrontToken: 'my-password',
    })
  })

  test('refreshes CLI2 cache with theme token command', async () => {
    // When
    await refreshTokens('my-store', 'my-password')

    // Then
    const expectedParams = ['theme', 'token', '--admin', 'my-password', '--sfr', 'my-password']
    expect(execCLI2).toHaveBeenCalledWith(expectedParams)
  })
})
