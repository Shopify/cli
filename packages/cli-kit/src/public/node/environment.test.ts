import {getAppAutomationToken, getBackendPort, maxRequestTimeForNetworkCallsMs} from './environment.js'
import {environmentVariables, systemEnvironmentVariables} from '../../private/node/constants.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  delete process.env[environmentVariables.appAutomationToken]
  delete process.env[environmentVariables.partnersToken]
  delete process.env[systemEnvironmentVariables.backendPort]
  delete process.env[environmentVariables.maxRequestTimeForNetworkCalls]
})

describe('getAppAutomationToken', () => {
  test('returns SHOPIFY_APP_AUTOMATION_TOKEN when set', () => {
    process.env[environmentVariables.appAutomationToken] = 'new-token'

    expect(getAppAutomationToken()).toBe('new-token')
  })

  test('returns SHOPIFY_CLI_PARTNERS_TOKEN when SHOPIFY_APP_AUTOMATION_TOKEN is not set', () => {
    process.env[environmentVariables.partnersToken] = 'old-token'

    expect(getAppAutomationToken()).toBe('old-token')
  })

  test('prefers SHOPIFY_APP_AUTOMATION_TOKEN over SHOPIFY_CLI_PARTNERS_TOKEN', () => {
    process.env[environmentVariables.appAutomationToken] = 'new-token'
    process.env[environmentVariables.partnersToken] = 'old-token'

    expect(getAppAutomationToken()).toBe('new-token')
  })

  test('returns undefined when neither env var is set', () => {
    expect(getAppAutomationToken()).toBeUndefined()
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
