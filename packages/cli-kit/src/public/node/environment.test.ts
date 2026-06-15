import {getAppAutomationToken} from './environment.js'
import {environmentVariables} from '../../private/node/constants.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  delete process.env[environmentVariables.appAutomationToken]
  delete process.env[environmentVariables.partnersToken]
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
