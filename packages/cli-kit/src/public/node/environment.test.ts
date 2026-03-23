import {getCliToken} from './environment.js'
import {environmentVariables} from '../../private/node/constants.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  delete process.env[environmentVariables.cliToken]
  delete process.env[environmentVariables.partnersToken]
})

describe('getCliToken', () => {
  test('returns SHOPIFY_CLI_TOKEN when set', () => {
    process.env[environmentVariables.cliToken] = 'new-token'

    expect(getCliToken()).toBe('new-token')
  })

  test('returns SHOPIFY_CLI_PARTNERS_TOKEN when SHOPIFY_CLI_TOKEN is not set', () => {
    process.env[environmentVariables.partnersToken] = 'old-token'

    expect(getCliToken()).toBe('old-token')
  })

  test('prefers SHOPIFY_CLI_TOKEN over SHOPIFY_CLI_PARTNERS_TOKEN', () => {
    process.env[environmentVariables.cliToken] = 'new-token'
    process.env[environmentVariables.partnersToken] = 'old-token'

    expect(getCliToken()).toBe('new-token')
  })

  test('returns undefined when neither env var is set', () => {
    expect(getCliToken()).toBeUndefined()
  })
})
