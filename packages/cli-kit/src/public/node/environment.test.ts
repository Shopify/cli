import {getAppAutomationToken, getIdentityTokenInformation} from './environment.js'
import {environmentVariables} from '../../private/node/constants.js'
import {describe, expect, test, beforeEach} from 'vitest'

beforeEach(() => {
  delete process.env[environmentVariables.appAutomationToken]
  delete process.env[environmentVariables.partnersToken]
  delete process.env[environmentVariables.identityToken]
  delete process.env[environmentVariables.refreshToken]
  delete process.env[environmentVariables.identityTokenUserId]
  delete process.env[environmentVariables.identityTokenExpiresAt]
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

describe('getIdentityTokenInformation', () => {
  test('returns undefined when either identity token or refresh token is missing', () => {
    process.env[environmentVariables.identityToken] = 'identity-token'

    expect(getIdentityTokenInformation()).toBeUndefined()
  })

  test('uses explicit user id and expiry when provided', () => {
    process.env[environmentVariables.identityToken] = 'identity-token'
    process.env[environmentVariables.refreshToken] = 'refresh-token'
    process.env[environmentVariables.identityTokenUserId] = 'placeholder-user-id'
    process.env[environmentVariables.identityTokenExpiresAt] = '2026-05-14T12:00:00.000Z'

    expect(getIdentityTokenInformation()).toEqual({
      accessToken: 'identity-token',
      refreshToken: 'refresh-token',
      userId: 'placeholder-user-id',
      expiresAt: new Date('2026-05-14T12:00:00.000Z'),
    })
  })

  test('falls back to hashing the identity token when no explicit user id is provided', () => {
    process.env[environmentVariables.identityToken] = 'identity-token'
    process.env[environmentVariables.refreshToken] = 'refresh-token'

    expect(getIdentityTokenInformation()).toEqual(
      expect.objectContaining({
        accessToken: 'identity-token',
        refreshToken: 'refresh-token',
      }),
    )
    expect(getIdentityTokenInformation()?.userId).toBeTruthy()
  })
})
