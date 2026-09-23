import {
  getAppAutomationToken,
  getAutomationToken,
  getBackendPort,
  maxRequestTimeForNetworkCallsMs,
} from './environment.js'
import {environmentVariables, systemEnvironmentVariables} from '../../private/node/constants.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  delete process.env[environmentVariables.organizationAutomationToken]
  delete process.env[environmentVariables.appAutomationToken]
  delete process.env[environmentVariables.partnersToken]
  delete process.env[systemEnvironmentVariables.backendPort]
  delete process.env[environmentVariables.maxRequestTimeForNetworkCalls]
})

describe('getAutomationToken', () => {
  test('returns SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN when set', () => {
    process.env[environmentVariables.organizationAutomationToken] = 'organization-token'

    expect(getAutomationToken()).toEqual({value: 'organization-token', source: 'organization'})
  })

  test('returns SHOPIFY_APP_AUTOMATION_TOKEN when no organization token is set', () => {
    process.env[environmentVariables.appAutomationToken] = 'app-token'

    expect(getAutomationToken()).toEqual({value: 'app-token', source: 'app'})
  })

  test('returns deprecated SHOPIFY_CLI_PARTNERS_TOKEN when no automation token is set', () => {
    process.env[environmentVariables.partnersToken] = 'partners-token'

    expect(getAutomationToken()).toEqual({value: 'partners-token', source: 'partners'})
  })

  test('prefers SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN over deprecated SHOPIFY_CLI_PARTNERS_TOKEN', () => {
    process.env[environmentVariables.organizationAutomationToken] = 'organization-token'
    process.env[environmentVariables.partnersToken] = 'partners-token'

    expect(getAutomationToken()).toEqual({value: 'organization-token', source: 'organization'})
  })

  test('preserves SHOPIFY_APP_AUTOMATION_TOKEN precedence over deprecated SHOPIFY_CLI_PARTNERS_TOKEN', () => {
    process.env[environmentVariables.appAutomationToken] = 'app-token'
    process.env[environmentVariables.partnersToken] = 'partners-token'

    expect(getAutomationToken()).toEqual({value: 'app-token', source: 'app'})
  })

  test('rejects simultaneous non-empty organization and app automation tokens', () => {
    process.env[environmentVariables.organizationAutomationToken] = 'organization-token'
    process.env[environmentVariables.appAutomationToken] = 'app-token'

    expect(() => getAutomationToken()).toThrow(
      "SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN and SHOPIFY_APP_AUTOMATION_TOKEN can't both be set.",
    )
  })

  test('ignores empty automation token values', () => {
    process.env[environmentVariables.organizationAutomationToken] = ''
    process.env[environmentVariables.appAutomationToken] = ''
    process.env[environmentVariables.partnersToken] = 'partners-token'

    expect(getAutomationToken()).toEqual({value: 'partners-token', source: 'partners'})
  })

  test('returns undefined when no token is set', () => {
    expect(getAutomationToken()).toBeUndefined()
  })
})

describe('getAppAutomationToken', () => {
  test('returns the canonical token value for backwards compatibility', () => {
    process.env[environmentVariables.organizationAutomationToken] = 'organization-token'

    expect(getAppAutomationToken()).toBe('organization-token')
  })
})

describe('getBackendPort', () => {
  test('returns parsed port when set to a valid number', () => {
    process.env[systemEnvironmentVariables.backendPort] = '8080'

    expect(getBackendPort()).toBe(8080)
  })

  test('returns undefined when set to an invalid number', () => {
    process.env[systemEnvironmentVariables.backendPort] = 'invalid-port'

    expect(getBackendPort()).toBeUndefined()
  })

  test('returns undefined when not set', () => {
    expect(getBackendPort()).toBeUndefined()
  })
})

describe('maxRequestTimeForNetworkCallsMs', () => {
  test('returns parsed max request time when set to a valid number', () => {
    const env = {
      [environmentVariables.maxRequestTimeForNetworkCalls]: '5000',
    }

    expect(maxRequestTimeForNetworkCallsMs(env)).toBe(5000)
  })

  test('returns default 30 seconds when set to an invalid number', () => {
    const env = {
      [environmentVariables.maxRequestTimeForNetworkCalls]: 'not-a-number',
    }

    expect(maxRequestTimeForNetworkCallsMs(env)).toBe(30000)
  })

  test('returns default 30 seconds when not set', () => {
    expect(maxRequestTimeForNetworkCallsMs({})).toBe(30000)
  })
})
