import {appClientSecret, fetchAppClientSecret, missingClientSecretTryMessage} from './organization.js'
import {testDeveloperPlatformClient, testOrganizationApp} from './app/app.test-data.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

function appWithRemoteSecrets(secrets: {secret: string}[]) {
  const appClientSecrets = vi.fn().mockResolvedValue(secrets)
  const remoteApp = testOrganizationApp({
    apiKey: 'api-key',
    apiSecretKeys: [],
    developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
  })
  return {remoteApp, appClientSecrets}
}

describe('fetchAppClientSecret', () => {
  test('returns an already loaded secret without asking the Developer Dashboard', async () => {
    // Given
    const appClientSecrets = vi.fn()
    const remoteApp = testOrganizationApp({
      apiSecretKeys: [{secret: ''}, {secret: 'secret-1'}],
      developerPlatformClient: testDeveloperPlatformClient({appClientSecrets}),
    })

    // When
    const secret = await fetchAppClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('secret-1')
    expect(appClientSecrets).not.toHaveBeenCalled()
  })

  test('asks the Developer Dashboard for the secret when it is not loaded', async () => {
    // Given
    const {remoteApp, appClientSecrets} = appWithRemoteSecrets([{secret: 'secret-1'}, {secret: 'secret-2'}])

    // When
    const secret = await fetchAppClientSecret(remoteApp)

    // Then
    expect(secret).toEqual('secret-1')
    expect(appClientSecrets).toHaveBeenCalledWith(remoteApp)
  })

  test('returns undefined when the Developer Dashboard returns no secrets', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(fetchAppClientSecret(remoteApp)).resolves.toBeUndefined()
  })
})

describe('appClientSecret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns the secret the Developer Dashboard returns to an automation token', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp} = appWithRemoteSecrets([{secret: 'secret-1'}])

    // When / Then
    await expect(appClientSecret(remoteApp)).resolves.toEqual('secret-1')
  })

  test('throws an AbortError when a logged-in user gets no secret', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp)).rejects.toThrow(AbortError)
    await expect(appClientSecret(remoteApp)).rejects.toMatchObject({
      message: expect.stringContaining("didn't return one for your credentials"),
      tryMessage: expect.stringContaining('Developer Dashboard'),
    })
  })

  test('suggests logging in when an automation token gets no secret', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'automation-token')
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp)).rejects.toMatchObject({
      tryMessage: expect.stringContaining('shopify auth login'),
    })
  })

  test.each(['SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'SHOPIFY_APP_AUTOMATION_TOKEN', 'SHOPIFY_CLI_PARTNERS_TOKEN'])(
    'tells the user to unset %s before logging in, without showing its value',
    async (variable) => {
      // Given
      vi.stubEnv(variable, 'automation-token-value')

      // When
      const message = missingClientSecretTryMessage()

      // Then
      expect(message).toContain(`unset ${variable}, log in with \`shopify auth login\`, and run the command again`)
      expect(message).not.toContain('automation-token-value')
    },
  )

  test('names every automation token variable that is set', async () => {
    // Given
    vi.stubEnv('SHOPIFY_SERVICE_ACCOUNT_TOKEN', 'token-1')
    vi.stubEnv('SHOPIFY_CLI_PARTNERS_TOKEN', 'token-2')

    // When
    const message = missingClientSecretTryMessage()

    // Then
    expect(message).toContain('unset SHOPIFY_SERVICE_ACCOUNT_TOKEN and SHOPIFY_CLI_PARTNERS_TOKEN,')
  })

  test('links a logged-in user to the Developer Dashboard', () => {
    // When
    const message = missingClientSecretTryMessage()

    // Then
    expect(message).toContain('Developer Dashboard: https://dev.shopify.com')
  })

  test('uses the command-specific way to provide the secret', async () => {
    // Given
    const {remoteApp} = appWithRemoteSecrets([])

    // When / Then
    await expect(appClientSecret(remoteApp, 'Pass the secret with a flag.')).rejects.toMatchObject({
      tryMessage: 'Pass the secret with a flag.',
    })
  })
})
